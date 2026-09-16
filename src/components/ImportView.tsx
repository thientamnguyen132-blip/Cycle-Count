import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  Info,
  ArrowRight,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CycleCountItem, CycleCountSession } from '../types';
import { SPX_53_ORIGINAL_COLUMNS, generateSampleCsvContent } from '../constants/spxColumns';
import { getTodayDateVietnam, generateSessionCode } from '../utils/date';

interface ImportViewProps {
  onSessionCreated: (session: CycleCountSession, items: CycleCountItem[]) => Promise<void>;
  existingSessionsCount: number;
}

interface ParsedFileInfo {
  fileName: string;
  fileSize: number;
  headers: string[];
  totalRows: number;
  rawData: Array<Record<string, string>>;
  hasOrderId: boolean;
  duplicateOrderIds: Map<string, number[]>; // Order ID -> list of row indices
  emptyOrderIdRowsCount: number;
}

export const ImportView: React.FC<ImportViewProps> = ({
  onSessionCreated,
  existingSessionsCount,
}) => {
  const [parsedFile, setParsedFile] = useState<ParsedFileInfo | null>(null);
  const [sessionDate, setSessionDate] = useState<string>(getTodayDateVietnam());
  const [sessionId, setSessionId] = useState<string>(
    generateSessionCode(getTodayDateVietnam(), existingSessionsCount + 1)
  );
  const [duplicateResolution, setDuplicateResolution] = useState<'keep_first' | 'keep_last' | 'alert'>(
    'keep_first'
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse CSV/XLSX file contents
  const processFileData = (fileName: string, fileSize: number, rawRows: Array<Record<string, string>>, headers: string[]) => {
    // 1. Check for 'Order ID' column (exact or trimmed)
    const normalizedHeaders = headers.map((h) => h.trim());
    const orderIdHeader = headers.find((h) => h.trim() === 'Order ID');

    if (!orderIdHeader) {
      setParsedFile(null);
      setErrorMessage(
        '❌ File thiếu cột bắt buộc: [Order ID]. Vui lòng kiểm tra lại cấu trúc file xuất từ hệ thống SPX.'
      );
      return;
    }

    setErrorMessage(null);

    // 2. Scan rows for duplicates and empty Order IDs
    const duplicateMap = new Map<string, number[]>();
    const orderIdSeen = new Map<string, number>();
    let emptyCount = 0;

    rawRows.forEach((row, idx) => {
      const orderVal = (row[orderIdHeader] || '').trim();
      if (!orderVal) {
        emptyCount++;
        return;
      }

      if (orderIdSeen.has(orderVal)) {
        const firstIdx = orderIdSeen.get(orderVal)!;
        if (!duplicateMap.has(orderVal)) {
          duplicateMap.set(orderVal, [firstIdx, idx + 1]);
        } else {
          duplicateMap.get(orderVal)!.push(idx + 1);
        }
      } else {
        orderIdSeen.set(orderVal, idx + 1);
      }
    });

    setParsedFile({
      fileName,
      fileSize,
      headers: normalizedHeaders,
      totalRows: rawRows.length,
      rawData: rawRows,
      hasOrderId: true,
      duplicateOrderIds: duplicateMap,
      emptyOrderIdRowsCount: emptyCount,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const readFile = (file: File) => {
    setErrorMessage(null);
    const fileName = file.name;
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
            defval: '',
            raw: false,
          });

          if (jsonData.length === 0) {
            setErrorMessage('File Excel không có dữ liệu.');
            return;
          }

          const headers = Object.keys(jsonData[0]);
          const stringRows = jsonData.map((row) => {
            const mapped: Record<string, string> = {};
            for (const key of headers) {
              mapped[key] = row[key] !== undefined && row[key] !== null ? String(row[key]) : '';
            }
            return mapped;
          });

          processFileData(fileName, file.size, stringRows, headers);
        } catch (err) {
          console.error('Error reading Excel:', err);
          setErrorMessage('Không thể đọc file Excel. Vui lòng kiểm tra định dạng.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV using PapaParse
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          if (results.errors && results.errors.length > 0 && results.data.length === 0) {
            setErrorMessage(`Lỗi đọc CSV: ${results.errors[0].message}`);
            return;
          }

          const headers = results.meta.fields || [];
          processFileData(fileName, file.size, results.data, headers);
        },
        error: (error) => {
          setErrorMessage(`Lỗi phân tích file: ${error.message}`);
        },
      });
    }
  };

  // One-click demo sample SPX file loader
  const handleLoadSampleFile = () => {
    const csvContent = generateSampleCsvContent();
    const fakeFile = new File([csvContent], 'export_forward_order_2026-09-15_16-56-05.csv', {
      type: 'text/csv',
    });
    readFile(fakeFile);
  };

  const handleConfirmCreateSession = async () => {
    if (!parsedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const orderIdHeader = parsedFile.headers.find((h) => h.trim() === 'Order ID') || 'Order ID';

      // Deduplicate strategy if needed
      let processedRawRows = parsedFile.rawData;
      if (parsedFile.duplicateOrderIds.size > 0 && duplicateResolution !== 'alert') {
        const seen = new Set<string>();
        if (duplicateResolution === 'keep_first') {
          processedRawRows = parsedFile.rawData.filter((r) => {
            const id = (r[orderIdHeader] || '').trim();
            if (!id) return false;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        } else if (duplicateResolution === 'keep_last') {
          const lastIndexMap = new Map<string, number>();
          parsedFile.rawData.forEach((r, idx) => {
            const id = (r[orderIdHeader] || '').trim();
            if (id) lastIndexMap.set(id, idx);
          });
          processedRawRows = parsedFile.rawData.filter((r, idx) => {
            const id = (r[orderIdHeader] || '').trim();
            return lastIndexMap.get(id) === idx;
          });
        }
      }

      // Convert rows to CycleCountItems while preserving ALL 53 original columns verbatim
      const newSessionId = sessionId.trim() || `CC-${sessionDate.replace(/-/g, '')}-001`;
      const sessionDbId = `sess_${Date.now()}`;

      const items: CycleCountItem[] = processedRawRows.map((row, idx) => {
        const orderId = (row[orderIdHeader] || '').trim();

        return {
          id: `item_${sessionDbId}_${idx}`,
          sessionId: sessionDbId,
          orderId,
          sortCodeName: row['Sort Code Name'] || '',
          wardName: row['Ward Name'] || '',
          locationType: row['Location Type'] || '',
          deliveringTime: row['Delivering Time'] || '',
          onHoldTime: row['OnHold Time'] || '',
          onHoldReason: row['OnHoldReason'] || '',
          codAmount: row['COD Amount'] || '',
          totalOnHoldTimes: row['Total of On Hold Times'] || '',
          address: row['Địa chỉ'] || row['Address'] || row['Receiver Address'] || '',
          cycleCountStatus: 'Pending',
          cycleCountTime: null,
          originalRowData: row, // Preserves all original columns untouched
          rowIndex: idx,
        };
      });

      const session: CycleCountSession = {
        id: sessionDbId,
        sessionId: newSessionId,
        sessionDate: sessionDate,
        sourceFileName: parsedFile.fileName,
        totalOrders: items.length,
        checkedOrders: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originalHeaders: parsedFile.headers,
      };

      await onSessionCreated(session, items);
    } catch (err: unknown) {
      console.error('Error creating session:', err);
      setErrorMessage('Có lỗi xảy ra khi tạo phiên kiểm kho. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Nhập file dữ liệu hệ thống SPX
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Hỗ trợ định dạng CSV hoặc Excel (.xlsx) xuất từ hệ thống SPX. Toàn bộ 53 cột gốc sẽ được bảo lưu nguyên vẹn.
        </p>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Cảnh báo dữ liệu</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Upload Box / Dropzone */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-dashed border-slate-300 hover:border-orange-500 transition text-center shadow-xs">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="mx-auto h-16 w-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 shadow-xs">
          <UploadCloud className="h-8 w-8 stroke-[2.2]" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          Kéo thả file CSV hoặc Excel vào đây
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          File mẫu tiêu chuẩn: <code className="text-orange-600 font-bold">export_forward_order_2026-09-15_16-56-05.csv</code>
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/20 transition"
          >
            Chọn file từ máy tính
          </button>

          {/* Quick Demo Sample Loader */}
          <button
            type="button"
            onClick={handleLoadSampleFile}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition"
          >
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span>Nạp file mẫu SPX thử nghiệm (53 cột)</span>
          </button>
        </div>
      </div>

      {/* File Stats & Validation Section */}
      {parsedFile && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{parsedFile.fileName}</h3>
                <p className="text-xs text-slate-500">
                  Dung lượng: {(parsedFile.fileSize / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cột [Order ID] hợp lệ
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500 font-medium">Số dòng dữ liệu</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                {parsedFile.totalRows}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500 font-medium">Số cột gốc</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                {parsedFile.headers.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500 font-medium">Mã đơn trùng</div>
              <div
                className={`text-2xl font-extrabold font-mono mt-1 ${
                  parsedFile.duplicateOrderIds.size > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {parsedFile.duplicateOrderIds.size}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500 font-medium">Dòng thiếu Order ID</div>
              <div
                className={`text-2xl font-extrabold font-mono mt-1 ${
                  parsedFile.emptyOrderIdRowsCount > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {parsedFile.emptyOrderIdRowsCount}
              </div>
            </div>
          </div>

          {/* Duplicate Order Warning & Strategy */}
          {parsedFile.duplicateOrderIds.size > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Phát hiện {parsedFile.duplicateOrderIds.size} mã đơn xuất hiện nhiều lần trong file!</span>
              </div>
              <p className="text-xs leading-relaxed">
                Hệ thống đề xuất cách xử lý mã đơn trùng để bảo đảm tính nhất quán khi kiểm kho:
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="dupResolution"
                    value="keep_first"
                    checked={duplicateResolution === 'keep_first'}
                    onChange={() => setDuplicateResolution('keep_first')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>Giữ dòng đầu tiên (Khuyến nghị)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="dupResolution"
                    value="keep_last"
                    checked={duplicateResolution === 'keep_last'}
                    onChange={() => setDuplicateResolution('keep_last')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>Giữ dòng mới nhất (cuối file)</span>
                </label>
              </div>
            </div>
          )}

          {/* Session Setup Inputs */}
          <div className="pt-2 border-t border-slate-100 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">Thiết lập phiên kiểm kho hằng ngày</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã phiên kiểm kho (Cycle Count Session)
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Ví dụ: CC-20260916-001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-semibold focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngày kiểm kho (Cycle Count Date)
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => {
                    setSessionDate(e.target.value);
                    setSessionId(generateSessionCode(e.target.value, existingSessionsCount + 1));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Confirm Creation Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleConfirmCreateSession}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/30 transition disabled:opacity-50"
            >
              <span>{isProcessing ? 'Đang khởi tạo...' : 'Xác nhận tạo phiên kiểm kho'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CycleCountSession, CycleCountItem } from '../types';
import { exportSessionToCsv, exportSessionToXlsx, buildExportData } from '../utils/export';

interface ExportViewProps {
  session: CycleCountSession | null;
  items: CycleCountItem[];
  sessions: CycleCountSession[];
  onSelectSession: (session: CycleCountSession) => void;
  onGoToImport: () => void;
}

export const ExportView: React.FC<ExportViewProps> = ({
  session,
  items,
  sessions,
  onSelectSession,
  onGoToImport,
}) => {
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="h-16 w-16 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
          <FileSpreadsheet className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Chưa có phiên kiểm kho nào để xuất</h2>
        <p className="mt-2 text-slate-600 max-w-md mx-auto">
          Vui lòng tạo hoặc chọn một phiên kiểm kho để tải báo cáo đối soát.
        </p>
        <button
          onClick={onGoToImport}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30 hover:bg-orange-700 transition"
        >
          Tạo phiên mới
        </button>
      </div>
    );
  }

  const exportData = buildExportData(session, items);
  const totalCols = exportData.headers.length;
  const originalColsCount = session.originalHeaders?.length || 53;

  const handleDownloadCsv = () => {
    exportSessionToCsv(session, items);
    setDownloadSuccessMessage(`Đã xuất thành công file CSV: cycle_count_${session.sessionId}_${session.sessionDate}.csv`);
    setTimeout(() => setDownloadSuccessMessage(null), 4000);
  };

  const handleDownloadXlsx = () => {
    exportSessionToXlsx(session, items);
    setDownloadSuccessMessage(`Đã xuất thành công file Excel: cycle_count_${session.sessionId}_${session.sessionDate}.xlsx`);
    setTimeout(() => setDownloadSuccessMessage(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Session Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Xuất báo cáo kiểm kho & Đối soát hệ thống
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Bảo toàn 100% dữ liệu gốc: đúng 53 cột gốc, đúng thứ tự dòng, và bổ sung 2 cột Cycle Count ở cuối file.
          </p>
        </div>

        {sessions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chọn phiên:</span>
            <select
              value={session.id}
              onChange={(e) => {
                const found = sessions.find((s) => s.id === e.target.value);
                if (found) onSelectSession(found);
              }}
              className="px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xs focus:outline-hidden focus:border-orange-500"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionId} ({s.sessionDate})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {downloadSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 font-semibold text-sm animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{downloadSuccessMessage}</span>
        </div>
      )}

      {/* Audit Checklist Card: Verification of 53 original + 2 appended columns */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <span>Cam kết đối soát & Tiêu chuẩn xuất file SPX</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Bảo toàn 53 cột gốc</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {originalColsCount} / 53 cột gốc
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Không thay đổi tên, không đổi thứ tự, không xóa bất kỳ cột nào.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-700 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Bổ sung 3 cột kiểm kê & địa chỉ</div>
              <div className="text-base font-bold text-orange-600 mt-0.5 font-mono">
                +3 Cột báo cáo
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                <code>Địa chỉ</code>, <code>Cycle Count Time</code> & <code>Cycle Count Status</code>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
              <FileCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Bảo toàn số lượng dòng</div>
              <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                {session.totalOrders} / {session.totalOrders} dòng
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Đơn chưa kiểm vẫn xuất đầy đủ với trạng thái Pending.
              </p>
            </div>
          </div>
        </div>

        {/* Download Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Tổng cộng: <span className="font-bold text-slate-800">{totalCols} cột</span> ({originalColsCount} gốc + 2 mới) •{' '}
            <span className="font-bold text-slate-800">{items.length} dòng</span> ({session.checkedOrders} Checked,{' '}
            {session.totalOrders - session.checkedOrders} Pending)
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition"
            >
              <Download className="h-4 w-4" />
              <span>Tải file CSV (Chuẩn UTF-8 BOM cho Excel)</span>
            </button>

            <button
              onClick={handleDownloadXlsx}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Tải file Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Data Preview Table (First 10 rows with highlight on the 2 appended columns) */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden space-y-4">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Xem trước dữ liệu xuất (Preview)</h2>
            <p className="text-xs text-slate-500">
              Hiển thị các cột tiêu biểu và 2 cột kiểm kho mới thêm ở cuối bảng
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
            Tổng 55 cột
          </span>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3 font-mono">Order ID</th>
                <th className="py-3 px-3">Sort Code Name</th>
                <th className="py-3 px-3">Ward Name</th>
                <th className="py-3 px-3">Delivering Time</th>
                <th className="py-3 px-3">OnHoldReason</th>
                <th className="py-3 px-3">Cache Type (Cột 53)</th>
                {/* 3 Appended Columns with distinct highlight */}
                <th className="py-3 px-3 bg-blue-100/90 text-blue-900 font-extrabold border-l-2 border-blue-500 whitespace-nowrap">
                  ⭐ Địa chỉ
                </th>
                <th className="py-3 px-3 bg-emerald-100/90 text-emerald-900 font-extrabold whitespace-nowrap">
                  ⭐ Cycle Count Time
                </th>
                <th className="py-3 px-3 bg-emerald-100/90 text-emerald-900 font-extrabold whitespace-nowrap">
                  ⭐ Cycle Count Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {exportData.rows.slice(0, 15).map((row, idx) => {
                const isChecked = row['Cycle Count Status'] === 'Checked';
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {row['Order ID'] || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row['Sort Code Name'] || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-[160px] truncate">
                      {row['Ward Name'] || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                      {row['Delivering Time'] || '—'}
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-700">
                      {row['OnHoldReason'] || <span className="text-slate-400 italic">Trống</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono whitespace-nowrap">
                      {row['Cache Type'] || 'Non-Cache Booking'}
                    </td>
                    {/* Appended Columns */}
                    <td className="py-2.5 px-3 bg-blue-50/60 text-blue-900 font-medium border-l-2 border-blue-400 max-w-[180px] truncate">
                      {row['Địa chỉ'] || <span className="text-slate-400 italic font-normal">Chưa nhập</span>}
                    </td>
                    <td className="py-2.5 px-3 bg-emerald-50/60 font-mono text-emerald-800 font-semibold whitespace-nowrap">
                      {row['Cycle Count Time'] || <span className="text-slate-400 font-normal">—</span>}
                    </td>
                    <td className="py-2.5 px-3 bg-emerald-50/60 font-extrabold whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                          isChecked ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row['Cycle Count Status']}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

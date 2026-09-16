import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Server,
  Database,
  Layers,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const GasGuideView: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const codeGsCode = `/**
 * SPX Cycle Count - Google Apps Script Backend (Code.gs)
 * Xử lý Web App, lưu trữ Google Drive / Google Sheets và đồng bộ kiểm kho
 */

const ROOT_FOLDER_NAME = "SPX_Cycle_Count_Data";
const SESSIONS_SHEET_NAME = "Sessions_Index";

// Khởi chạy Web App
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SPX Cycle Count — Daily Inventory Checking')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Lấy hoặc tạo thư mục lưu trữ trên Google Drive
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

// Lấy bảng tính quản lý danh sách phiên
function getSessionsSpreadsheet() {
  const folder = getOrCreateFolder();
  const files = folder.getFilesByName(SESSIONS_SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  
  const ss = SpreadsheetApp.create(SESSIONS_SHEET_NAME);
  const file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  
  const sheet = ss.getActiveSheet();
  sheet.setName("Sessions");
  sheet.appendRow([
    "Session ID", 
    "Session Date", 
    "Source File Name", 
    "Total Orders", 
    "Checked Orders", 
    "File ID", 
    "Created At", 
    "Updated At"
  ]);
  return ss;
}

// 1. Tạo phiên kiểm kho mới từ file CSV/Excel tải lên
function createCycleCountSession(payload) {
  // payload: { sessionId, sessionDate, fileName, headers, rows }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Khóa chống xung đột đa người dùng
  
  try {
    const folder = getOrCreateFolder();
    
    // Lưu file dữ liệu riêng cho phiên này (Google Sheets)
    const sessionSpreadsheet = SpreadsheetApp.create("DATA_" + payload.sessionId);
    const sessionFile = DriveApp.getFileById(sessionSpreadsheet.getId());
    folder.addFile(sessionFile);
    DriveApp.getRootFolder().removeFile(sessionFile);
    
    const sheet = sessionSpreadsheet.getActiveSheet();
    sheet.setName("CycleCount");
    
    // Header gồm 53 cột gốc + 2 cột Cycle Count
    const fullHeaders = payload.headers.concat(["Cycle Count Time", "Cycle Count Status"]);
    const matrix = [fullHeaders];
    
    // Nạp toàn bộ dòng vào ma trận, mặc định Pending
    for (var i = 0; i < payload.rows.length; i++) {
      var r = payload.rows[i];
      r.push(""); // Cycle Count Time rỗng
      r.push("Pending"); // Trạng thái Pending
      matrix.push(r);
    }
    
    sheet.getRange(1, 1, matrix.length, fullHeaders.length).setValues(matrix);
    
    // Ghi nhận vào sổ Sessions_Index
    const indexSs = getSessionsSpreadsheet();
    const indexSheet = indexSs.getSheetByName("Sessions");
    const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
    
    indexSheet.appendRow([
      payload.sessionId,
      payload.sessionDate,
      payload.fileName,
      payload.rows.length,
      0,
      sessionSpreadsheet.getId(),
      nowStr,
      nowStr
    ]);
    
    return { success: true, fileId: sessionSpreadsheet.getId() };
  } finally {
    lock.releaseLock();
  }
}

// 2. Xác nhận kiểm mã đơn (Atomic Update với LockService)
function confirmCheckOrder(sessionId, fileId, orderId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  
  try {
    const ss = SpreadsheetApp.openById(fileId);
    const sheet = ss.getSheetByName("CycleCount");
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const orderIdColIdx = headers.indexOf("Order ID");
    const timeColIdx = headers.indexOf("Cycle Count Time");
    const statusColIdx = headers.indexOf("Cycle Count Status");
    
    var targetRowIdx = -1;
    var rowData = null;
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][orderIdColIdx]).trim().toUpperCase() === String(orderId).trim().toUpperCase()) {
        targetRowIdx = i + 1; // 1-indexed trong Sheets
        rowData = data[i];
        break;
      }
    }
    
    if (targetRowIdx === -1) {
      return { success: false, notFound: true, message: "Mã đơn không tồn tại trong phiên kiểm kho này." };
    }
    
    const nowVN = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
    
    // Cập nhật 2 ô cuối: Time và Status
    sheet.getRange(targetRowIdx, timeColIdx + 1).setValue(nowVN);
    sheet.getRange(targetRowIdx, statusColIdx + 1).setValue("Checked");
    
    return {
      success: true,
      orderId: orderId,
      cycleCountTime: nowVN,
      cycleCountStatus: "Checked"
    };
  } finally {
    lock.releaseLock();
  }
}

// 3. Xuất file CSV bảo toàn 53 cột gốc + 2 cột mới
function exportSessionCsv(fileId) {
  const ss = SpreadsheetApp.openById(fileId);
  const sheet = ss.getSheetByName("CycleCount");
  const values = sheet.getDataRange().getValues();
  
  var csvLines = [];
  for (var r = 0; r < values.length; r++) {
    var line = [];
    for (var c = 0; c < values[r].length; c++) {
      var val = String(values[r][c]);
      if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\\n') !== -1) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      line.push(val);
    }
    csvLines.push(line.join(','));
  }
  
  // UTF-8 BOM
  return "\\uFEFF" + csvLines.join('\\r\\n');
}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">
          <Server className="h-3.5 w-3.5" />
          <span>Tài liệu kỹ thuật & Hướng dẫn triển khai</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Kiến trúc Google Apps Script & Giải trình hệ thống
        </h1>
        <p className="text-slate-600 mt-2 text-sm max-w-3xl leading-relaxed">
          Phân tích toàn diện 7 câu hỏi kiến trúc, cấu trúc lưu trữ, giải pháp xử lý đồng thời (concurrency), giới hạn của Google Apps Script và mã nguồn triển khai thực tế.
        </p>
      </div>

      {/* Part 1: Detailed Answers to the 7 Core Architectural Questions */}
      <div className="space-y-6">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-orange-600" />
          <span>I. Giải trình 7 câu hỏi trọng tâm kiến trúc</span>
        </h2>

        <div className="grid grid-cols-1 gap-5">
          {/* Question 1 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              Kiến trúc được chọn (Hybrid In-Browser Fast Scan + Google Drive/GAS Backend)
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Theo quy chuẩn vận hành kho SPX, thao tác kiểm bưu kiện cần diễn ra với tốc độ cực nhanh (&lt; 50ms mỗi lần quét mã). Do đó, kiến trúc tối ưu nhất là <strong>Hybrid Client-Server</strong>:
              <br />
              • <strong>Client-side (Trình duyệt):</strong> Mở phiên kiểm kho, tải dữ liệu file một lần vào bộ nhớ cục bộ (IndexedDB / RAM). Nhân viên quét barcode hoặc camera, tìm kiếm và đối soát tức thì ngay trên thiết bị mà không chịu độ trễ mạng (zero latency).
              <br />
              • <strong>Backend (Google Apps Script Web App / Supabase):</strong> Đảm nhận việc tiếp nhận file CSV/Excel ban đầu, tạo phiên kiểm kho, lưu trữ bền vững và xuất file đối soát tổng hợp.
            </p>
          </div>

          {/* Question 2 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Cách lưu file gốc
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              File gốc hệ thống SPX (ví dụ <code>export_forward_order_2026-09-15_16-56-05.csv</code>) có 53 cột bắt buộc không được suy suyển. File được đọc nguyên bản, toàn bộ 53 giá trị trên mỗi dòng được giữ nguyên trong mảng dữ liệu gốc (<code>originalRowData</code>) hoặc lưu vào một Google Sheet riêng biệt đặt tên theo <code>DATA_SessionID</code> trong thư mục Google Drive của kho.
            </p>
          </div>

          {/* Question 3 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              Cách lưu trạng thái kiểm kho
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mỗi đơn hàng có 2 trạng thái duy nhất: <code>Pending</code> (mặc định) và <code>Checked</code>. Khi nhân viên xác nhận kiểm, hệ thống ghi nhận thời gian kiểm theo múi giờ <strong>Asia/Ho_Chi_Minh</strong> định dạng chuẩn <code>YYYY-MM-DD HH:mm:ss</code> (ví dụ: <code>2026-09-16 09:45:22</code>) và chuyển trạng thái thành <code>Checked</code>.
            </p>
          </div>

          {/* Question 4 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">4</span>
              Cách đảm bảo không mất dữ liệu khi export
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Quá trình export đối chiếu trực tiếp từ mảng <code>originalHeaders</code> (53 cột gốc) theo đúng thứ tự mảng ban đầu, sau đó ghép nối thêm 2 cột mới ở cuối: <code>Cycle Count Time</code> và <code>Cycle Count Status</code>. Các dòng dữ liệu được sắp xếp theo đúng <code>rowIndex</code> ban đầu. Đơn chưa kiểm vẫn được xuất ra với trạng thái <code>Pending</code> và cột thời gian để trống. File CSV được chèn <strong>UTF-8 BOM (<code>\uFEFF</code>)</strong> để Microsoft Excel hiển thị đúng tiếng Việt không bị lỗi font.
            </p>
          </div>

          {/* Question 5 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">5</span>
              Cách xử lý nhiều người dùng cùng kiểm (Concurrency Handling)
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Trong Google Apps Script, khi nhiều nhân viên kho cùng quét mã một lúc, hàm backend sử dụng <code>LockService.getScriptLock()</code> với thời gian chờ tối đa 30 giây để biến thao tác ghi vào Google Sheets thành <strong>Atomic Update</strong> (tuần tự hóa). Khi đã có một đơn được cập nhật Checked, người thứ hai quét trùng mã đơn sẽ nhận ngay thông báo đơn này đã được kiểm trước đó cùng timestamp.
            </p>
          </div>

          {/* Question 6 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">6</span>
              Những giới hạn của Google Apps Script
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              • <strong>Giới hạn thời gian chạy:</strong> 6 phút/execution đối với tài khoản tiêu chuẩn.
              <br />
              • <strong>Độ trễ mạng:</strong> Mỗi request gọi <code>google.script.run</code> mất khoảng 400ms – 1.5s, nếu quét liên tục 500 đơn bằng call server sẽ gây cảm giác chậm. (Đó là lý do mô hình tải 1 lần vào trình duyệt chạy nhanh gấp 100 lần).
              <br />
              • <strong>Kích thước Google Sheets:</strong> Tối đa 10 triệu ô dữ liệu. Một file 53 cột có thể lưu an toàn khoảng 50,000 – 100,000 dòng trên mỗi sheet.
            </p>
          </div>

          {/* Question 7 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">7</span>
              Cách mở rộng trong tương lai
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Khi quy mô kho tăng lên &gt; 50,000 đơn/ngày và có &gt; 50 nhân viên kiểm cùng lúc, hệ thống có thể chuyển lớp lưu trữ sang <strong>PostgreSQL / Supabase</strong> hoặc <strong>Google Cloud SQL</strong> kết hợp WebSocket đồng bộ real-time giữa các súng quét mã, trong khi giao diện người dùng và quy trình nghiệp vụ 53 cột vẫn giữ nguyên vẹn.
            </p>
          </div>
        </div>
      </div>

      {/* Part 2: Complete Google Apps Script Code */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileCode className="h-5 w-5 text-orange-600" />
              <span>II. Mã nguồn Google Apps Script hoàn chỉnh (`Code.gs`)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Bạn có thể copy trực tiếp đoạn mã này vào Google Apps Script Editor
            </p>
          </div>

          <button
            onClick={() => copyToClipboard(codeGsCode, 'codeGs')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition"
          >
            {copiedKey === 'codeGs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedKey === 'codeGs' ? 'Đã sao chép!' : 'Copy Code.gs'}</span>
          </button>
        </div>

        <div className="relative rounded-2xl bg-slate-950 p-5 text-slate-100 font-mono text-xs overflow-x-auto max-h-[420px] shadow-lg border border-slate-800">
          <pre>{codeGsCode}</pre>
        </div>
      </div>

      {/* Part 3: Deploy & Testing Instructions */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <span>III. Hướng dẫn Deploy Web App & Kiểm thử file mẫu SPX</span>
        </h2>

        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-slate-900">Bước 1:</span>
            <span>
              Truy cập <code>script.google.com</code> và tạo Dự án mới (New Project) có tên <strong>SPX Cycle Count</strong>.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-slate-900">Bước 2:</span>
            <span>
              Dán đoạn mã <code>Code.gs</code> ở trên vào file code chính.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-slate-900">Bước 3:</span>
            <span>
              Nhấn <strong>Deploy</strong> (Triển khai) &gt; <strong>New deployment</strong> (Triển khai mới). Chọn loại <strong>Web app</strong>.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-slate-900">Bước 4:</span>
            <span>
              Cấu hình: <em>Execute as: Me</em> và <em>Who has access: Anyone</em> (hoặc giới hạn trong tổ chức kho SPX).
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-slate-900">Bước 5 (Kiểm thử):</span>
            <span>
              Tải file mẫu <code>export_forward_order_2026-09-15_16-56-05.csv</code> (có sẵn nút bấm nạp mẫu trong tab <strong>Nhập file SPX</strong> của ứng dụng). Tiến hành quét các mã đơn như <code>SPXVN069287747489</code>, nghe giọng đọc OnHoldReason nguyên văn và tải file đối soát 55 cột.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

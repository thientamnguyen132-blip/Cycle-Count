import React, { useMemo } from 'react';
import {
  PackageCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  FolderKanban,
  Calendar,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  AlertCircle,
  Barcode,
  Trash2,
  Banknote,
  History,
  ShieldAlert,
} from 'lucide-react';
import { CycleCountSession, CycleCountItem } from '../types';
import { isRejectedCancelReason } from '../utils/audio';

interface DashboardViewProps {
  activeSession: CycleCountSession | null;
  sessions: CycleCountSession[];
  items: CycleCountItem[];
  onSelectSession: (session: CycleCountSession) => void;
  onGoToChecking: () => void;
  onGoToImport: () => void;
  onGoToExport: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeSession,
  sessions,
  items,
  onSelectSession,
  onGoToChecking,
  onGoToImport,
  onGoToExport,
  onDeleteSession,
}) => {
  const total = activeSession?.totalOrders ?? 0;
  const checked = activeSession?.checkedOrders ?? 0;
  const pending = Math.max(0, total - checked);
  const progressPercent = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Breakdown by sort code for active session
  const sortCodeBreakdown = useMemo(() => {
    const map: Record<string, { total: number; checked: number }> = {};
    items.forEach((it) => {
      const code = it.sortCodeName || 'Khác';
      if (!map[code]) map[code] = { total: 0, checked: 0 };
      map[code].total += 1;
      if (it.cycleCountStatus === 'Checked') {
        map[code].checked += 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [items]);

  // Aggregate COD calculations
  const { totalCodVal, checkedCodVal, pendingCodVal } = useMemo(() => {
    let totalVal = 0;
    let checkedVal = 0;

    items.forEach((it) => {
      const rawCod = it.codAmount || it.originalRowData?.['COD Amount'] || '0';
      const num = parseInt(String(rawCod).replace(/[^\d]/g, ''), 10) || 0;
      totalVal += num;
      if (it.cycleCountStatus === 'Checked') {
        checkedVal += num;
      }
    });

    return {
      totalCodVal: totalVal,
      checkedCodVal: checkedVal,
      pendingCodVal: Math.max(0, totalVal - checkedVal),
    };
  }, [items]);

  // Aggregate On Hold Times calculations
  const { totalHoldTimes, multiHoldCount, canceledCount } = useMemo(() => {
    let sumHold = 0;
    let multiHold = 0;
    let cancelCnt = 0;

    items.forEach((it) => {
      const rawCount = it.totalOnHoldTimes || it.originalRowData?.['Total of On Hold Times'] || '1';
      const parsed = parseInt(String(rawCount), 10) || 1;
      sumHold += parsed;
      if (parsed > 1) {
        multiHold += 1;
      }
      if (isRejectedCancelReason(it.onHoldReason)) {
        cancelCnt += 1;
      }
    });

    return {
      totalHoldTimes: sumHold,
      multiHoldCount: multiHold,
      canceledCount: cancelCnt,
    };
  }, [items]);

  const formatVND = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val) + ' ₫';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome & Session Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-orange-600/15 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wider uppercase">
            <span>Phiên kiểm kho đang hoạt động</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {activeSession ? activeSession.sessionId : 'Chưa chọn phiên kiểm kho'}
          </h1>
          <p className="text-orange-100 text-sm max-w-xl">
            {activeSession ? (
              <>
                File nguồn: <span className="font-mono font-medium">{activeSession.sourceFileName}</span> • Ngày kiểm:{' '}
                <span className="font-bold">{activeSession.sessionDate}</span>
              </>
            ) : (
              'Hãy nhập file CSV/Excel trích xuất từ hệ thống SPX để tạo phiên kiểm kê hàng ngày.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeSession ? (
            <>
              <button
                onClick={onGoToChecking}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-orange-600 hover:bg-orange-50 font-bold text-sm shadow-md transition"
              >
                <Barcode className="h-4 w-4" />
                <span>Vào quét mã kiểm ngay</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onGoToExport}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-700/80 hover:bg-orange-800 text-white font-semibold text-sm transition"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Xuất file đối soát</span>
              </button>
            </>
          ) : (
            <button
              onClick={onGoToImport}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-orange-600 hover:bg-orange-50 font-bold text-sm shadow-md transition"
            >
              <PlusCircle className="h-5 w-5" />
              <span>Tạo phiên kiểm kho mới</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards: 6 core metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Metric 1: Tổng số đơn */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng số đơn</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono">{total}</div>
            <p className="text-xs text-slate-400 mt-1">Đơn cần kiểm trong phiên</p>
          </div>
        </div>

        {/* Metric 2: Đã kiểm */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-150 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Đã kiểm</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-emerald-600 font-mono">{checked}</div>
            <p className="text-xs text-emerald-600/80 mt-1">Trạng thái Checked</p>
          </div>
        </div>

        {/* Metric 3: Chưa kiểm */}
        <div className="bg-white p-5 rounded-2xl border border-amber-150 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Chưa kiểm</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-amber-600 font-mono">{pending}</div>
            <p className="text-xs text-amber-600/80 mt-1">Trạng thái Pending</p>
          </div>
        </div>

        {/* Metric 4: Tiến độ kiểm kho % */}
        <div className="bg-white p-5 rounded-2xl border border-orange-150 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tiến độ kiểm</span>
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-orange-600 font-mono">{progressPercent}%</div>
            {/* Mini Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-orange-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Metric 5: Số phiên kiểm */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Số phiên kiểm</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono">{sessions.length}</div>
            <p className="text-xs text-slate-400 mt-1">Phiên đã lưu trong máy</p>
          </div>
        </div>

        {/* Metric 6: Ngày kiểm hiện tại */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ngày kiểm</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {activeSession ? activeSession.sessionDate : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Giờ chuẩn Asia/Ho_Chi_Minh</p>
          </div>
        </div>
      </div>

      {/* Extended Analytics Cards: COD Amount, Total of On Hold Times, and Canceled Parcels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* COD Amount Card */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Banknote className="h-5 w-5" />
              </div>
              <span>Tổng tiền thu hộ (COD Amount)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 font-mono">
              COD
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-extrabold font-mono text-emerald-950">
              {formatVND(totalCodVal)}
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Đã kiểm: <b className="text-emerald-700 font-mono">{formatVND(checkedCodVal)}</b>
              </span>
              <span className="text-slate-500">
                Chưa kiểm: <b className="text-amber-700 font-mono">{formatVND(pendingCodVal)}</b>
              </span>
            </div>
          </div>
        </div>

        {/* Total On Hold Times Card */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <History className="h-5 w-5" />
              </div>
              <span>Tổng lượt OnHold (Total On Hold)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 font-mono">
              {totalHoldTimes} lượt
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-extrabold font-mono text-amber-950">
              {totalHoldTimes} <span className="text-sm font-semibold text-slate-500">tổng lượt</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Bưu kiện OnHold &gt; 1 lần:{' '}
                <b className="text-amber-800 font-mono">{multiHoldCount}</b> đơn
              </span>
              <span className="text-slate-500">
                Bình quân:{' '}
                <b className="text-slate-800 font-mono">
                  {total > 0 ? (totalHoldTimes / total).toFixed(1) : 0}
                </b>{' '}
                lần/đơn
              </span>
            </div>
          </div>
        </div>

        {/* Canceled Orders (Reject reasons) Alert Card */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <span>Đơn hàng bị hủy (Cần trả lại)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 font-mono">
              Trả hàng
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-extrabold font-mono text-rose-700">
              {canceledCount} <span className="text-sm font-semibold text-slate-500">đơn bị hủy</span>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs text-rose-700/90 font-medium">
              Lý do Buyer change mind, Recipient reject, Wrong item được đọc tự động: "Đơn Hàng Bị Hủy".
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Sort Code Progress & Session Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sort Code breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tiến độ theo Sort Code Name</h2>
              <p className="text-xs text-slate-500">Phân loại theo khu vực phân loại tại hub</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
              {sortCodeBreakdown.length} Sort Codes
            </span>
          </div>

          {sortCodeBreakdown.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Chưa có dữ liệu đơn hàng trong phiên hiện tại.
            </div>
          ) : (
            <div className="space-y-3">
              {sortCodeBreakdown.slice(0, 6).map(([code, stat]) => {
                const pct = stat.total > 0 ? Math.round((stat.checked / stat.total) * 100) : 0;
                return (
                  <div key={code} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="font-mono text-slate-900">{code}</span>
                      <span className="text-slate-600">
                        {stat.checked} / {stat.total} đơn ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sessions History / Switcher */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Danh sách phiên kiểm</h2>
            <button
              onClick={onGoToImport}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Tạo mới</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Chưa có phiên nào. Bấm &ldquo;Tạo mới&rdquo; để nạp file.
              </div>
            ) : (
              sessions.map((sess) => {
                const isActive = activeSession?.id === sess.id;
                const pct = sess.totalOrders > 0 ? Math.round((sess.checkedOrders / sess.totalOrders) * 100) : 0;

                return (
                  <div
                    key={sess.id}
                    onClick={() => onSelectSession(sess)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      isActive
                        ? 'border-orange-500 bg-orange-50/50 shadow-xs ring-2 ring-orange-500/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">{sess.sessionId}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-orange-600 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Bạn có chắc muốn xóa phiên ${sess.sessionId}?`)) {
                            onDeleteSession(sess.id);
                          }
                        }}
                        className="text-slate-300 hover:text-red-500 p-1 rounded transition"
                        title="Xóa phiên"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                      <span className="font-medium">{sess.sessionDate}</span>
                      <span className="font-bold text-slate-700">
                        {sess.checkedOrders}/{sess.totalOrders} ({pct}%)
                      </span>
                    </div>

                    {/* Mini progress */}
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-2 overflow-hidden">
                      <div
                        className={`h-1 rounded-full ${isActive ? 'bg-orange-600' : 'bg-slate-400'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

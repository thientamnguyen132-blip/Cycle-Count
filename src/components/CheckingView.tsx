import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Barcode,
  Camera,
  CheckCircle2,
  Clock,
  Volume2,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  MapPin,
  Building,
  Calendar,
  X,
  VolumeX,
  Banknote,
  History,
  Zap,
  Sparkles,
  Check,
  Edit3,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { CycleCountItem, CycleCountSession, AudioSettings } from '../types';
import { getNowVietnamString } from '../utils/date';
import {
  speakOnHoldReason,
  playSuccessBeep,
  playWarningBuzzer,
  playAlreadyCheckedChime,
  isRejectedCancelReason,
} from '../utils/audio';
import { BarcodeCameraModal } from './BarcodeCameraModal';

interface RecentScan {
  orderId: string;
  time: string;
  status: 'Checked' | 'Pending';
  isCancel?: boolean;
}

interface CheckingViewProps {
  session: CycleCountSession | null;
  items: CycleCountItem[];
  audioSettings: AudioSettings;
  onUpdateItemStatus: (item: CycleCountItem, newStatus: 'Checked' | 'Pending', timeStr: string | null) => Promise<void>;
  onUpdateItemAddress?: (item: CycleCountItem, newAddress: string) => Promise<void>;
  onGoToImport: () => void;
}

export const CheckingView: React.FC<CheckingViewProps> = ({
  session,
  items,
  audioSettings,
  onUpdateItemStatus,
  onUpdateItemAddress,
  onGoToImport,
}) => {
  // Search & input states
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<CycleCountItem | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  // Default auto-confirm to TRUE for ultra-fast handheld scanner workflow
  const [autoConfirmOnScan, setAutoConfirmOnScan] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Address editing state for the active card
  const [editingAddress, setEditingAddress] = useState<string>('');
  const [isAddressSaved, setIsAddressSaved] = useState<boolean>(false);

  // Visual success feedback state (Green flash & indicator)
  const [greenFlash, setGreenFlash] = useState<boolean>(false);
  const [lastScannedOrder, setLastScannedOrder] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  // Filters for order list
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHECKED' | 'PENDING'>('ALL');
  const [sortCodeFilter, setSortCodeFilter] = useState<string>('ALL');
  const [wardFilter, setWardFilter] = useState<string>('ALL');
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Keep search input focused for hardware handheld barcode scanners
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [selectedItem, session]);

  // Sync address state when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const addr = selectedItem.address || selectedItem.originalRowData?.['Địa chỉ'] || selectedItem.originalRowData?.['Address'] || '';
      setEditingAddress(addr);
      setIsAddressSaved(false);
    }
  }, [selectedItem?.id]);

  // If no item is explicitly selected, auto-select the first pending item if available
  useEffect(() => {
    if (!selectedItem && items.length > 0) {
      const firstPending = items.find((it) => it.cycleCountStatus === 'Pending') || items[0];
      setSelectedItem(firstPending);
    }
  }, [items, selectedItem]);

  // Extract unique filter lists
  const uniqueSortCodes = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.sortCodeName) set.add(it.sortCodeName);
    });
    return Array.from(set).sort();
  }, [items]);

  const uniqueWards = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.wardName) set.add(it.wardName);
    });
    return Array.from(set).sort();
  }, [items]);

  // Fast map lookup by Order ID for instant in-browser response (O(1))
  const orderMap = useMemo(() => {
    const map = new Map<string, CycleCountItem>();
    items.forEach((it) => {
      map.set(it.orderId.trim().toUpperCase(), it);
    });
    return map;
  }, [items]);

  // Filtered items for table
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter === 'CHECKED' && item.cycleCountStatus !== 'Checked') return false;
      if (statusFilter === 'PENDING' && item.cycleCountStatus !== 'Pending') return false;

      // Sort code filter
      if (sortCodeFilter !== 'ALL' && item.sortCodeName !== sortCodeFilter) return false;

      // Ward filter
      if (wardFilter !== 'ALL' && item.wardName !== wardFilter) return false;

      // Search query in table
      if (searchTableQuery.trim()) {
        const q = searchTableQuery.trim().toUpperCase();
        return (
          item.orderId.toUpperCase().includes(q) ||
          item.sortCodeName.toUpperCase().includes(q) ||
          item.wardName.toUpperCase().includes(q) ||
          item.onHoldReason.toUpperCase().includes(q) ||
          (item.address && item.address.toUpperCase().includes(q))
        );
      }

      return true;
    });
  }, [items, statusFilter, sortCodeFilter, wardFilter, searchTableQuery]);

  // Trigger Green Flash & ting sound
  const triggerGreenFlash = (orderId: string) => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    setGreenFlash(true);
    setLastScannedOrder(orderId);
    flashTimerRef.current = window.setTimeout(() => {
      setGreenFlash(false);
    }, 1200);
  };

  // TTS speech trigger with state
  const handleSpeakReason = (reason: string) => {
    setIsSpeaking(true);
    speakOnHoldReason(reason, {
      rate: audioSettings.speechRate,
      onEnd: () => setIsSpeaking(false),
    });
  };

  // Triggered when an order is opened / clicked in table
  const handleOpenItem = (item: CycleCountItem, triggerTTS: boolean = true) => {
    setSelectedItem(item);
    setWarningMessage(null);

    if (triggerTTS && audioSettings.ttsEnabled) {
      handleSpeakReason(item.onHoldReason);
    }
  };

  // Main barcode scanning logic (Ultra-fast, zero-delay execution)
  const handleProcessBarcode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setWarningMessage(null);
      setSearchInput('');

      // Instant O(1) map lookup
      const foundItem = orderMap.get(code);

      if (!foundItem) {
        setWarningMessage(`Mã đơn [${code}] không tồn tại trong phiên kiểm kho này.`);
        if (audioSettings.soundFxEnabled) {
          playWarningBuzzer();
        }
        isProcessingRef.current = false;
        barcodeInputRef.current?.focus();
        return;
      }

      // Found the order! Select immediately
      setSelectedItem(foundItem);

      // Trigger TTS: If canceled order, speech engine automatically says "Đơn Hàng Bị Hủy"
      if (audioSettings.ttsEnabled) {
        handleSpeakReason(foundItem.onHoldReason);
      }

      const isCanceled = isRejectedCancelReason(foundItem.onHoldReason);

      if (foundItem.cycleCountStatus === 'Checked') {
        if (audioSettings.soundFxEnabled) {
          playAlreadyCheckedChime();
        }
        setRecentScans((prev) => [
          { orderId: foundItem.orderId, time: getNowVietnamString(), status: 'Checked', isCancel: isCanceled },
          ...prev.slice(0, 4),
        ]);
      } else {
        if (autoConfirmOnScan) {
          // Instant confirmation (Ting chime + Green flash + Optimistic state update)
          const nowVN = getNowVietnamString();

          if (audioSettings.soundFxEnabled) {
            playSuccessBeep();
          }

          triggerGreenFlash(foundItem.orderId);

          setRecentScans((prev) => [
            { orderId: foundItem.orderId, time: nowVN, status: 'Checked', isCancel: isCanceled },
            ...prev.slice(0, 4),
          ]);

          await onUpdateItemStatus(foundItem, 'Checked', nowVN);
        }
      }

      isProcessingRef.current = false;
      barcodeInputRef.current?.focus();
    },
    [orderMap, audioSettings, autoConfirmOnScan, onUpdateItemStatus]
  );

  // Quick typing / hardware scanner auto-detect
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);

    const clean = val.trim().toUpperCase();
    // If hardware scanner fires full code or pastes exact match
    if (clean.length >= 10 && orderMap.has(clean)) {
      handleProcessBarcode(clean);
    }
  };

  const handleConfirmChecked = async (item: CycleCountItem) => {
    const nowVN = getNowVietnamString();
    if (audioSettings.soundFxEnabled) {
      playSuccessBeep();
    }
    triggerGreenFlash(item.orderId);

    const isCanceled = isRejectedCancelReason(item.onHoldReason);
    setRecentScans((prev) => [
      { orderId: item.orderId, time: nowVN, status: 'Checked', isCancel: isCanceled },
      ...prev.slice(0, 4),
    ]);

    await onUpdateItemStatus(item, 'Checked', nowVN);
  };

  const handleRevertPending = async (item: CycleCountItem) => {
    await onUpdateItemStatus(item, 'Pending', null);
  };

  const handleSaveAddress = async () => {
    if (!selectedItem || !onUpdateItemAddress) return;
    await onUpdateItemAddress(selectedItem, editingAddress.trim());
    setIsAddressSaved(true);
    setTimeout(() => setIsAddressSaved(false), 2000);
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="h-16 w-16 mx-auto rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
          <Barcode className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Chưa có phiên kiểm kho nào được tạo</h2>
        <p className="mt-2 text-slate-600 max-w-md mx-auto">
          Vui lòng tải lên file dữ liệu hệ thống SPX (CSV/XLSX) hoặc nạp file mẫu để bắt đầu quét và kiểm kho.
        </p>
        <button
          onClick={onGoToImport}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30 hover:bg-orange-700 transition"
        >
          Nhập file SPX ngay
        </button>
      </div>
    );
  }

  const isCurrentCanceled = selectedItem ? isRejectedCancelReason(selectedItem.onHoldReason) : false;
  const currentCodAmount = selectedItem?.codAmount || selectedItem?.originalRowData?.['COD Amount'] || '0 VND';
  const currentTotalOnHold = selectedItem?.totalOnHoldTimes || selectedItem?.originalRowData?.['Total of On Hold Times'] || '1';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Scanner Bar: Hardware Scanner Optimized + Visual Green Flash */}
      <div
        className={`rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-300 border ${
          greenFlash
            ? 'bg-emerald-50/90 border-emerald-500 ring-4 ring-emerald-500/20 shadow-emerald-500/10'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Main Barcode Scanner Input */}
          <div className="relative flex-1">
            <div
              className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                greenFlash ? 'text-emerald-600' : 'text-orange-600'
              }`}
            >
              <Barcode className="h-6 w-6" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchInput}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleProcessBarcode(searchInput);
                }
              }}
              placeholder="Quét mã vạch hoặc nhập mã đơn SPXVN... (Nhận diện siêu tốc)"
              className={`w-full pl-12 pr-28 py-3.5 rounded-xl border-2 font-mono text-base font-bold placeholder:text-slate-400 focus:outline-hidden transition ${
                greenFlash
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-4 ring-emerald-500/20'
                  : 'border-orange-500/80 bg-orange-50/20 text-slate-900 focus:border-orange-600 focus:ring-4 focus:ring-orange-500/20'
              }`}
              autoFocus
            />
            <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleProcessBarcode(searchInput)}
                disabled={!searchInput.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs shadow-xs transition"
              >
                Kiểm tra
              </button>
            </div>
          </div>

          {/* Camera Scanner Button */}
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-semibold text-sm shadow-xs transition shrink-0"
          >
            <Camera className="h-4 w-4 text-orange-400" />
            <span>Mở Camera quét</span>
          </button>

          {/* Super-Speed Auto-Confirm Toggle */}
          <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/80 cursor-pointer select-none text-xs font-bold text-emerald-900 transition shrink-0">
            <input
              type="checkbox"
              checked={autoConfirmOnScan}
              onChange={(e) => setAutoConfirmOnScan(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" />
              <span>Quét là kiểm ngay (Siêu tốc)</span>
            </span>
          </label>
        </div>

        {/* Green Flash Confirmation Banner */}
        {greenFlash && lastScannedOrder && (
          <div className="mt-3 py-2 px-4 bg-emerald-600 text-white rounded-xl flex items-center justify-between text-xs font-bold shadow-md shadow-emerald-600/20 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span>Ting! Đã kiểm kho thành công mã đơn:</span>
              <span className="font-mono text-sm underline tracking-wider">{lastScannedOrder}</span>
            </div>
            <span className="bg-emerald-700 px-2 py-0.5 rounded text-[11px]">Đã lưu hệ thống</span>
          </div>
        )}

        {/* Not Found Warning Alert */}
        {warningMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">{warningMessage}</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Hệ thống tuân thủ nguyên tắc không thêm đơn ngoài file gốc vào phiên kiểm kho. Vui lòng kiểm tra lại bưu kiện!
                </p>
              </div>
            </div>
            <button
              onClick={() => setWarningMessage(null)}
              className="p-1 rounded-md text-red-400 hover:bg-red-100 hover:text-red-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Real-time Recent Scans Ribbon */}
        {recentScans.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="h-3 w-3" /> Vừa quét:
            </span>
            {recentScans.map((rs, idx) => (
              <span
                key={`${rs.orderId}-${idx}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold ${
                  rs.isCancel
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {rs.isCancel ? <ShieldAlert className="h-3 w-3 text-rose-600" /> : <Check className="h-3 w-3 text-emerald-600" />}
                {rs.orderId}
                <span className="text-[10px] font-normal opacity-75">({rs.time.split(' ')[1] || rs.time})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Order Card: Displaying All Key Fields + COD Amount + Total of On Hold Times + Address */}
      {selectedItem ? (
        <div
          className={`bg-white rounded-2xl shadow-xs border transition-all duration-300 overflow-hidden ${
            isCurrentCanceled
              ? 'border-rose-300 ring-2 ring-rose-200'
              : selectedItem.cycleCountStatus === 'Checked'
              ? 'border-emerald-200 ring-1 ring-emerald-100'
              : 'border-slate-200'
          }`}
        >
          {/* Prominent Rejected / Canceled Alert Banner */}
          {isCurrentCanceled && (
            <div className="bg-rose-600 text-white px-5 py-3 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <ShieldAlert className="h-5 w-5 text-yellow-300 shrink-0 animate-bounce" />
                <span>CẢNH BÁO: ĐƠN HÀNG BỊ HỦY — Vui lòng xếp vào giỏ hàng hoàn / trả hàng ngay!</span>
              </div>
              <button
                onClick={() => handleSpeakReason(selectedItem.onHoldReason)}
                className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Nghe loa: "Đơn Hàng Bị Hủy"</span>
              </button>
            </div>
          )}

          {/* Card Header with Status & Action */}
          <div
            className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${
              selectedItem.cycleCountStatus === 'Checked'
                ? 'bg-emerald-50/70 border-emerald-100'
                : 'bg-amber-50/70 border-amber-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
                  selectedItem.cycleCountStatus === 'Checked'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {selectedItem.cycleCountStatus === 'Checked' ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : (
                  <Clock className="h-7 w-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Mã đơn SPXVN
                  </span>
                  {isCurrentCanceled && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                      Đơn hàng bị hủy
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 tracking-tight">
                  {selectedItem.orderId}
                </h1>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {selectedItem.cycleCountStatus === 'Pending' ? (
                <button
                  onClick={() => handleConfirmChecked(selectedItem)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/30 active:scale-95 transition"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Xác nhận đã kiểm</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Đã kiểm lúc: {selectedItem.cycleCountTime}</span>
                  </div>
                  <button
                    onClick={() => handleRevertPending(selectedItem)}
                    title="Chuyển lại về trạng thái Chưa kiểm nếu kiểm nhầm"
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card Body: Highlighted Metrics & All Core Fields */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* High-priority Highlights: COD Amount & Total of On Hold Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Highlight 1: COD Amount */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span>Tiền thu hộ (COD Amount)</span>
                  </div>
                  <div className="text-xl font-mono font-extrabold text-emerald-900">
                    {currentCodAmount}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  COD
                </div>
              </div>

              {/* Highlight 2: Total of On Hold Times */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1">
                    <History className="h-4 w-4 text-amber-600" />
                    <span>Số lần OnHold (Total On Hold)</span>
                  </div>
                  <div className="text-xl font-mono font-extrabold text-amber-900">
                    {currentTotalOnHold} <span className="text-xs font-semibold text-amber-700">lần</span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  Hold
                </div>
              </div>

              {/* Highlight 3: Sort Code */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <Building className="h-4 w-4 text-slate-400" />
                  <span>Sort Code Name</span>
                </div>
                <div className="text-lg font-mono font-bold text-slate-900">
                  {selectedItem.sortCodeName || '—'}
                </div>
              </div>

              {/* Highlight 4: Cycle Count Status */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  <span>Trạng thái kiểm kho</span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                      selectedItem.cycleCountStatus === 'Checked'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedItem.cycleCountStatus === 'Checked' ? '✓ Checked (Đã kiểm)' : '⏳ Pending (Chưa kiểm)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Ward Name */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>Ward Name (Phường / Xã)</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 line-clamp-1">
                  {selectedItem.wardName || '—'}
                </div>
              </div>

              {/* Location Type */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <Building className="h-4 w-4 text-slate-400" />
                  <span>Location Type</span>
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {selectedItem.locationType || '—'}
                </div>
              </div>

              {/* Delivering Time */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>Delivering Time</span>
                </div>
                <div className="text-xs font-mono text-slate-700">
                  {selectedItem.deliveringTime || '—'}
                </div>
              </div>
            </div>

            {/* Address Input & OnHold Reason Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Editable Address Field */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/70">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Edit3 className="h-4 w-4 text-blue-600" />
                    <span>Cột Địa chỉ (Nhập tiếp địa chỉ để xuất file báo cáo)</span>
                  </div>
                  {isAddressSaved && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Đã lưu
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingAddress}
                    onChange={(e) => setEditingAddress(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveAddress();
                      }
                    }}
                    placeholder="Nhập địa chỉ người nhận hoặc ghi chú vị trí..."
                    className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-blue-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    onClick={handleSaveAddress}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                  >
                    Lưu
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-blue-700/80">
                  Cột Địa chỉ này sẽ được xuất kèm đầy đủ vào file báo cáo Excel / CSV.
                </p>
              </div>

              {/* OnHoldReason with Enhanced TTS */}
              <div
                className={`p-4 rounded-xl border ${
                  isCurrentCanceled
                    ? 'bg-rose-50/70 border-rose-300'
                    : 'bg-orange-50/60 border-orange-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Volume2 className={`h-4 w-4 ${isCurrentCanceled ? 'text-rose-600' : 'text-orange-600'}`} />
                    <span>Lý do OnHold</span>
                    {isCurrentCanceled && (
                      <span className="ml-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold">
                        Hủy đơn
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleSpeakReason(selectedItem.onHoldReason)}
                    disabled={isSpeaking}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      isSpeaking
                        ? 'bg-orange-600 text-white animate-pulse'
                        : isCurrentCanceled
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                        : 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs'
                    }`}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>
                      {isSpeaking
                        ? 'Đang phát...'
                        : isCurrentCanceled
                        ? '🔊 Đọc: "Đơn Hàng Bị Hủy"'
                        : '🔊 Đọc lại'}
                    </span>
                  </button>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-900 font-medium text-sm">
                  {selectedItem.onHoldReason?.trim() ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900 font-semibold">{selectedItem.onHoldReason}</span>
                      {isCurrentCanceled && (
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Đơn Hàng Bị Hủy
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Không có lý do OnHold</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Orders Table & Search/Filter Controls */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-slate-500" />
              <h2 className="font-bold text-slate-800 text-base">Danh sách đơn hàng trong phiên</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {filteredItems.length}/{items.length} đơn
              </span>
            </div>

            {/* Status Filters */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({items.length})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'PENDING'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                Chưa kiểm ({items.filter((i) => i.cycleCountStatus === 'Pending').length})
              </button>
              <button
                onClick={() => setStatusFilter('CHECKED')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'CHECKED'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Đã kiểm ({items.filter((i) => i.cycleCountStatus === 'Checked').length})
              </button>
            </div>
          </div>

          {/* Secondary Filters: Search, Sort Code, Ward */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                placeholder="Tìm mã đơn, COD, địa chỉ, lý do..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-orange-500"
              />
            </div>

            <select
              value={sortCodeFilter}
              onChange={(e) => setSortCodeFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-orange-500 font-medium"
            >
              <option value="ALL">Tất cả Sort Code ({uniqueSortCodes.length})</option>
              {uniqueSortCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>

            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-orange-500 font-medium"
            >
              <option value="ALL">Tất cả Phường/Xã ({uniqueWards.length})</option>
              {uniqueWards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content with COD, OnHold Times, and Address */}
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3">STT</th>
                <th className="py-3 px-3">Mã đơn SPXVN</th>
                <th className="py-3 px-3 text-emerald-800">COD Amount</th>
                <th className="py-3 px-3 text-amber-800">OnHold Times</th>
                <th className="py-3 px-3">Sort Code</th>
                <th className="py-3 px-3">Ward Name</th>
                <th className="py-3 px-3 text-blue-800">Địa chỉ</th>
                <th className="py-3 px-3">OnHoldReason</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isCurrent = selectedItem?.id === item.id;
                  const isChecked = item.cycleCountStatus === 'Checked';
                  const isCanceled = isRejectedCancelReason(item.onHoldReason);
                  const cod = item.codAmount || item.originalRowData?.['COD Amount'] || '0 VND';
                  const onHoldCount = item.totalOnHoldTimes || item.originalRowData?.['Total of On Hold Times'] || '1';
                  const addr = item.address || item.originalRowData?.['Địa chỉ'] || item.originalRowData?.['Address'] || '—';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenItem(item, true)}
                      className={`cursor-pointer transition hover:bg-slate-50 ${
                        isCurrent ? 'bg-orange-50/70 font-semibold' : ''
                      } ${isCanceled ? 'bg-rose-50/30' : ''}`}
                    >
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isCanceled && <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />}
                          <span>{item.orderId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {cod}
                      </td>
                      <td className="py-3 px-3 font-mono text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            Number(onHoldCount) > 1
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {onHoldCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {item.sortCodeName || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-[150px] truncate" title={item.wardName}>
                        {item.wardName || '—'}
                      </td>
                      <td className="py-3 px-3 text-blue-900 max-w-[160px] truncate" title={addr}>
                        {addr !== '—' ? addr : <span className="text-slate-400 italic">Chưa nhập</span>}
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`truncate ${isCanceled ? 'text-rose-700 font-bold' : 'text-slate-700'}`}
                            title={item.onHoldReason || 'Không có lý do OnHold'}
                          >
                            {isCanceled ? `🚫 ${item.onHoldReason}` : item.onHoldReason || <span className="text-slate-400 italic">Trống</span>}
                          </span>
                          {item.onHoldReason && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSpeakReason(item.onHoldReason);
                              }}
                              className="text-orange-600 hover:text-orange-800 p-1 shrink-0"
                              title={isCanceled ? 'Nghe đọc: Đơn Hàng Bị Hủy' : 'Nghe đọc lý do'}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isChecked
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isChecked ? 'Đã kiểm' : 'Chưa kiểm'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isChecked ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevertPending(item);
                            }}
                            className="text-slate-400 hover:text-slate-600 px-2 py-1 rounded text-[11px]"
                          >
                            Hủy
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmChecked(item);
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs"
                          >
                            Kiểm
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Camera Modal */}
      <BarcodeCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(code) => handleProcessBarcode(code)}
      />
    </div>
  );
};

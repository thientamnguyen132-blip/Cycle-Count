import React from 'react';
import {
  PackageCheck,
  LayoutDashboard,
  Barcode,
  UploadCloud,
  FileSpreadsheet,
  BookOpen,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
} from 'lucide-react';
import { CycleCountSession, AudioSettings } from '../types';

export type TabType = 'dashboard' | 'checking' | 'import' | 'export' | 'gas_guide';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  activeSession: CycleCountSession | null;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: Partial<AudioSettings>) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeSession,
  audioSettings,
  onUpdateAudioSettings,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="h-10 w-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <PackageCheck className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">SPX Cycle Count</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-700 tracking-wider">
                  DAILY
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Kiểm kho hàng ngày & Đối soát 53 cột
              </p>
            </div>
          </div>

          {/* Active Session Badge */}
          {activeSession && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold">{activeSession.sessionId}</span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-600">{activeSession.sessionDate}</span>
              <span className="text-slate-400">|</span>
              <span className="text-orange-600 font-medium">
                {activeSession.checkedOrders}/{activeSession.totalOrders} đơn ({activeSession.totalOrders > 0 ? Math.round((activeSession.checkedOrders / activeSession.totalOrders) * 100) : 0}%)
              </span>
            </div>
          )}

          {/* Quick Sound/TTS Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onUpdateAudioSettings({ ttsEnabled: !audioSettings.ttsEnabled })}
              title={audioSettings.ttsEnabled ? 'Đang bật đọc to OnHoldReason (Click để tắt)' : 'Đang tắt đọc to (Click để bật)'}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                audioSettings.ttsEnabled
                  ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {audioSettings.ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden lg:inline">Giọng đọc OnHold</span>
            </button>

            <button
              onClick={() => onUpdateAudioSettings({ soundFxEnabled: !audioSettings.soundFxEnabled })}
              title={audioSettings.soundFxEnabled ? 'Âm báo quét mã: BẬT' : 'Âm báo quét mã: TẮT'}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                audioSettings.soundFxEnabled
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {audioSettings.soundFxEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              <span className="hidden lg:inline">Âm báo</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-100 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
              currentTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>

          <button
            onClick={() => onSelectTab('checking')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition relative ${
              currentTab === 'checking'
                ? 'bg-orange-600 text-white shadow-xs shadow-orange-500/20'
                : 'text-slate-600 hover:text-orange-600 hover:bg-orange-50'
            }`}
          >
            <Barcode className="h-4 w-4" />
            Kiểm kho & Quét mã
            {activeSession && activeSession.totalOrders > activeSession.checkedOrders && (
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('import')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
              currentTab === 'import'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Nhập file SPX
          </button>

          <button
            onClick={() => onSelectTab('export')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
              currentTab === 'export'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất báo cáo đối soát
          </button>

          <button
            onClick={() => onSelectTab('gas_guide')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
              currentTab === 'gas_guide'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Hướng dẫn GAS & Kiến trúc
          </button>
        </nav>
      </div>
    </header>
  );
};

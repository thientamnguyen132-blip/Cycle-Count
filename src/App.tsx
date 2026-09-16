import React, { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { CheckingView } from './components/CheckingView';
import { ImportView } from './components/ImportView';
import { ExportView } from './components/ExportView';
import { GasGuideView } from './components/GasGuideView';
import { CycleCountSession, CycleCountItem, AudioSettings } from './types';
import {
  getAllSessions,
  getSessionItems,
  saveSessionWithItems,
  updateItemCheckStatus,
  updateItemRecord,
  deleteSession,
  getActiveSessionId,
} from './utils/storage';
import {
  SPX_53_ORIGINAL_COLUMNS,
  SAMPLE_SPX_ORDERS,
  buildSampleSpxRow,
} from './constants/spxColumns';
import { getTodayDateVietnam } from './utils/date';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [sessions, setSessions] = useState<CycleCountSession[]>([]);
  const [activeSession, setActiveSession] = useState<CycleCountSession | null>(null);
  const [items, setItems] = useState<CycleCountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    ttsEnabled: true,
    soundFxEnabled: true,
    speechRate: 1.0,
  });

  // Initialize storage & sessions on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        let loadedSessions = await getAllSessions();

        // If user has zero sessions on first launch, auto-populate the realistic sample session
        // so the app is instantly working and testable right away!
        if (loadedSessions.length === 0) {
          const sampleSessionId = 'CC-20260916-001';
          const sessionDbId = 'sess_sample_init';
          const sampleDate = getTodayDateVietnam();

          const sampleItems: CycleCountItem[] = SAMPLE_SPX_ORDERS.map((sample, idx) => {
            const rawRow = buildSampleSpxRow(sample, idx);
            // Pre-check 2 orders for realistic initial progress
            const isPreChecked = idx === 0 || idx === 1;
            return {
              id: `item_sample_${idx}`,
              sessionId: sessionDbId,
              orderId: sample.orderId,
              sortCodeName: sample.sortCode,
              wardName: sample.ward,
              locationType: sample.locationType,
              deliveringTime: sample.deliveringTime,
              onHoldTime: sample.onHoldTime,
              onHoldReason: sample.onHoldReason,
              cycleCountStatus: isPreChecked ? 'Checked' : 'Pending',
              cycleCountTime: isPreChecked ? '2026-09-16 09:45:22' : null,
              originalRowData: rawRow,
              rowIndex: idx,
            };
          });

          const newSession: CycleCountSession = {
            id: sessionDbId,
            sessionId: sampleSessionId,
            sessionDate: sampleDate,
            sourceFileName: 'export_forward_order_2026-09-15_16-56-05.csv',
            totalOrders: sampleItems.length,
            checkedOrders: sampleItems.filter((i) => i.cycleCountStatus === 'Checked').length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            originalHeaders: [...SPX_53_ORIGINAL_COLUMNS],
          };

          await saveSessionWithItems(newSession, sampleItems);
          loadedSessions = [newSession];
        }

        setSessions(loadedSessions);

        const savedActiveId = getActiveSessionId();
        const initialActive =
          loadedSessions.find((s) => s.id === savedActiveId) || loadedSessions[0] || null;

        setActiveSession(initialActive);

        if (initialActive) {
          const sessionItems = await getSessionItems(initialActive.id);
          setItems(sessionItems);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // When active session changes, load its items
  const handleSelectSession = async (session: CycleCountSession) => {
    setActiveSession(session);
    const sessionItems = await getSessionItems(session.id);
    setItems(sessionItems);
  };

  // Create new session from ImportView
  const handleSessionCreated = async (
    newSession: CycleCountSession,
    newItems: CycleCountItem[]
  ) => {
    await saveSessionWithItems(newSession, newItems);
    const updatedSessions = await getAllSessions();
    setSessions(updatedSessions);
    setActiveSession(newSession);
    setItems(newItems);
    // Switch to checking view immediately to begin scanning!
    setCurrentTab('checking');
  };

  // Update an order's status (Checked / Pending)
  const handleUpdateItemStatus = async (
    item: CycleCountItem,
    newStatus: 'Checked' | 'Pending',
    timeStr: string | null
  ) => {
    // Instant optimistic update for maximum scanning speed
    const updated: CycleCountItem = {
      ...item,
      cycleCountStatus: newStatus,
      cycleCountTime: newStatus === 'Checked' ? timeStr : null,
      updatedAt: new Date().toISOString(),
    };

    setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));

    // Update activeSession count in state
    if (activeSession && activeSession.id === item.sessionId) {
      const diff = newStatus === 'Checked' && item.cycleCountStatus !== 'Checked' ? 1 : (newStatus === 'Pending' && item.cycleCountStatus === 'Checked' ? -1 : 0);
      if (diff !== 0) {
        setActiveSession((prev) =>
          prev
            ? {
                ...prev,
                checkedOrders: Math.max(0, Math.min(prev.totalOrders, prev.checkedOrders + diff)),
                updatedAt: new Date().toISOString(),
              }
            : null
        );

        // Also update in sessions list
        setSessions((prevList) =>
          prevList.map((s) =>
            s.id === item.sessionId
              ? {
                  ...s,
                  checkedOrders: Math.max(0, Math.min(s.totalOrders, s.checkedOrders + diff)),
                  updatedAt: new Date().toISOString(),
                }
              : s
          )
        );
      }
    }

    // Persist to storage in background
    updateItemCheckStatus(item, newStatus, timeStr).catch((err) => {
      console.warn('Storage persistence sync error:', err);
    });
  };

  // Update an order's custom address
  const handleUpdateItemAddress = async (
    item: CycleCountItem,
    newAddress: string
  ) => {
    const updated: CycleCountItem = {
      ...item,
      address: newAddress,
      updatedAt: new Date().toISOString(),
    };

    setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    updateItemRecord(updated).catch((err) => {
      console.warn('Failed to save address update:', err);
    });
  };

  // Delete a session
  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId);
    const remaining = sessions.filter((s) => s.id !== sessionId);
    setSessions(remaining);
    if (activeSession?.id === sessionId) {
      const nextActive = remaining[0] || null;
      setActiveSession(nextActive);
      if (nextActive) {
        const nextItems = await getSessionItems(nextActive.id);
        setItems(nextItems);
      } else {
        setItems([]);
      }
    }
  };

  const handleUpdateAudioSettings = (partial: Partial<AudioSettings>) => {
    setAudioSettings((prev) => ({ ...prev, ...partial }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeSession={activeSession}
        audioSettings={audioSettings}
        onUpdateAudioSettings={handleUpdateAudioSettings}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Đang khởi tạo cơ sở dữ liệu kiểm kho...
            </p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                activeSession={activeSession}
                sessions={sessions}
                items={items}
                onSelectSession={handleSelectSession}
                onGoToChecking={() => setCurrentTab('checking')}
                onGoToImport={() => setCurrentTab('import')}
                onGoToExport={() => setCurrentTab('export')}
                onDeleteSession={handleDeleteSession}
              />
            )}

            {currentTab === 'checking' && (
              <CheckingView
                session={activeSession}
                items={items}
                audioSettings={audioSettings}
                onUpdateItemStatus={handleUpdateItemStatus}
                onUpdateItemAddress={handleUpdateItemAddress}
                onGoToImport={() => setCurrentTab('import')}
              />
            )}

            {currentTab === 'import' && (
              <ImportView
                onSessionCreated={handleSessionCreated}
                existingSessionsCount={sessions.length}
              />
            )}

            {currentTab === 'export' && (
              <ExportView
                session={activeSession}
                items={items}
                sessions={sessions}
                onSelectSession={handleSelectSession}
                onGoToImport={() => setCurrentTab('import')}
              />
            )}

            {currentTab === 'gas_guide' && <GasGuideView />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>SPX Cycle Count</strong> — Hệ thống kiểm kho nội bộ & đối soát dữ liệu 53 cột gốc
          </div>
          <div className="text-slate-400">
            Giờ hệ thống: Asia/Ho_Chi_Minh • Tối ưu quét mã vạch không độ trễ
          </div>
        </div>
      </footer>
    </div>
  );
}

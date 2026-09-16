export type CycleCountStatus = 'Pending' | 'Checked';

export interface CycleCountItem {
  id: string;
  sessionId: string;
  orderId: string; // SPXVN...
  sortCodeName: string;
  wardName: string;
  locationType: string;
  deliveringTime: string;
  onHoldTime: string;
  onHoldReason: string;
  codAmount?: string;
  totalOnHoldTimes?: string;
  address?: string; // New field for user to view/enter address
  cycleCountStatus: CycleCountStatus;
  cycleCountTime: string | null; // e.g. '2026-09-16 09:45:22'
  originalRowData: Record<string, string>; // Preserves all 53 original columns verbatim
  rowIndex: number; // Original line sequence in imported file
  updatedAt?: string;
}

export interface CycleCountSession {
  id: string;
  sessionId: string; // e.g. 'CC-20260916-001'
  sessionDate: string; // e.g. '2026-09-16'
  sourceFileName: string; // e.g. 'export_forward_order_2026-09-15_16-56-05.csv'
  totalOrders: number;
  checkedOrders: number;
  createdAt: string;
  updatedAt: string;
  originalHeaders: string[]; // Exactly 53 original headers
}

export interface SessionSummary {
  total: number;
  checked: number;
  pending: number;
  progressPercent: number;
  sortCodes: Record<string, { total: number; checked: number }>;
  wards: Record<string, { total: number; checked: number }>;
}

export interface AudioSettings {
  ttsEnabled: boolean; // Auto-read on order open
  soundFxEnabled: boolean; // Beep on scan/check
  speechRate: number; // 0.8 - 1.2
}

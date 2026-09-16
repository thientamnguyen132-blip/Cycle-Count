import { CycleCountItem, CycleCountSession } from '../types';
import { CYCLE_COUNT_APPENDED_COLUMNS } from '../constants/spxColumns';
import * as XLSX from 'xlsx';

/**
 * Ensures strict export matching:
 * 1. Exactly the original headers (usually 53) in exact order
 * 2. Exactly + 'Cycle Count Time' and 'Cycle Count Status' at the end
 * 3. All rows preserved in original sequence
 * 4. Original values untouched
 */

export function buildExportData(
  session: CycleCountSession,
  items: CycleCountItem[]
): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  // Original headers from session file
  const originalHeaders = session.originalHeaders && session.originalHeaders.length > 0
    ? session.originalHeaders
    : [];

  const headers = [...originalHeaders, ...CYCLE_COUNT_APPENDED_COLUMNS];

  // Sort strictly by original rowIndex
  const sortedItems = [...items].sort((a, b) => a.rowIndex - b.rowIndex);

  const rows = sortedItems.map((item) => {
    const rowRecord: Record<string, string> = {};

    // 1. Copy every original column verbatim
    for (const h of originalHeaders) {
      rowRecord[h] = item.originalRowData?.[h] ?? '';
    }

    // 2. Append the cycle count fields + Địa chỉ
    rowRecord['Địa chỉ'] = item.address ?? item.originalRowData?.['Địa chỉ'] ?? item.originalRowData?.['Address'] ?? item.originalRowData?.['Receiver Address'] ?? '';
    rowRecord['Cycle Count Time'] = item.cycleCountTime ?? '';
    rowRecord['Cycle Count Status'] = item.cycleCountStatus;

    return rowRecord;
  });

  return { headers, rows };
}

/**
 * Exports to CSV with UTF-8 BOM (\uFEFF) to guarantee Excel in Vietnam displays accents correctly
 */
export function exportSessionToCsv(session: CycleCountSession, items: CycleCountItem[]): void {
  const { headers, rows } = buildExportData(session, items);

  const escapeCsvCell = (val: string): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((r) => headers.map((h) => escapeCsvCell(r[h] ?? '')).join(','));

  // Prepend UTF-8 BOM
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `cycle_count_${session.sessionId}_${session.sessionDate}.csv`;

  downloadBlob(blob, filename);
}

/**
 * Exports to Microsoft Excel (.xlsx) using SheetJS
 */
export function exportSessionToXlsx(session: CycleCountSession, items: CycleCountItem[]): void {
  const { headers, rows } = buildExportData(session, items);

  // Convert array of objects with explicit header sequence to a 2D array
  const aoa: string[][] = [headers];
  for (const r of rows) {
    aoa.push(headers.map((h) => r[h] ?? ''));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Adjust column widths automatically
  const colWidths = headers.map((h) => {
    const maxLen = Math.max(h.length, 12);
    return { wch: Math.min(maxLen, 35) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cycle Count SPX');

  const filename = `cycle_count_${session.sessionId}_${session.sessionDate}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

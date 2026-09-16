/**
 * Date formatting helpers strictly matching Asia/Ho_Chi_Minh timezone
 * Expected format: YYYY-MM-DD HH:mm:ss (e.g. 2026-09-16 09:45:22)
 */

export function getNowVietnamString(): string {
  const now = new Date();
  // Formatter targeting Asia/Ho_Chi_Minh timezone
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(now);
  const partMap: Record<string, string> = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  const year = partMap.year || '2026';
  const month = partMap.month || '09';
  const day = partMap.day || '16';
  const hour = partMap.hour || '09';
  const minute = partMap.minute || '00';
  const second = partMap.second || '00';

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function getTodayDateVietnam(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(now); // YYYY-MM-DD
}

export function generateSessionCode(dateStr: string, sessionIndex: number = 1): string {
  // Format: CC-YYYYMMDD-001
  const cleanDate = dateStr.replace(/-/g, '');
  const seq = sessionIndex.toString().padStart(3, '0');
  return `CC-${cleanDate}-${seq}`;
}

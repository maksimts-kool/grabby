/**
 * Number and time formatting, following the design system's content rules:
 * sizes in MB with no decimals above 10 ("18 MB", "9.4 MB"), relative times under a day
 * ("12 min ago", "2 h ago"), then dates ("16 Nov").
 */
const MB = 1024 * 1024;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function trim(n: number, decimals: number) {
  return n.toFixed(decimals).replace(/\.0+$/, '');
}

export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / MB;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${trim(mb, 1)} MB`;
}

/** "25.4 of 41 MB" */
export function formatTransferred(done: number, total: number | null | undefined): string {
  const doneMb = trim(done / MB, 1);
  if (!total) return `${doneMb} MB`;
  return `${doneMb} of ${formatSize(total).replace(' MB', '')} MB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < MB) return `${Math.round(bytesPerSecond / 1024)} KB/s`;
  return `${trim(bytesPerSecond / MB, 1)} MB/s`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)} s left`;
  return `${Math.ceil(seconds / 60)} min left`;
}

/** 24-hour clock, no leading zero: "9:29", "15:29". */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "16 Nov" */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "just now", "12 min ago", "2 h ago", then "16 Nov". */
export function formatRelative(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return '';
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(ts);
}

/** "Today" / "Yesterday" / "16 Nov" — Activity section headers. */
export function formatDay(ts: number, now = Date.now()): string {
  const start = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((start(now) - start(ts)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatDate(ts);
}

export function plural(count: number, one: string, other: string): string {
  return `${count} ${count === 1 ? one : other}`;
}

/** Joins the truthy parts with " · ". */
export function meta(...parts: (string | number | null | undefined | false)[]): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '').join(' · ');
}

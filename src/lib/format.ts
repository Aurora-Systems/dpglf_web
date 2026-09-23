/**
 * The Foundation's clock. Deadlines are set, shown and enforced in Harare time
 * (CAT, UTC+2, no daylight saving), whatever zone the server or the browser is
 * in; otherwise the same form shows one time when rendered on the server and
 * another after hydration, and saving it moves the deadline.
 */
export const FOUNDATION_TZ = 'Africa/Harare';
export const FOUNDATION_TZ_LABEL = 'CAT';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: FOUNDATION_TZ,
});

const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FOUNDATION_TZ,
});

/** `YYYY-MM-DDTHH:mm` wall-clock time in Harare, as `<input type="datetime-local">` wants. */
const LOCAL_INPUT_FMT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: FOUNDATION_TZ,
});

export function toFoundationInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(LOCAL_INPUT_FMT.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return 'Not set';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Not set' : DATE_FMT.format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return 'Not set';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Not set' : `${DATETIME_FMT.format(d)} ${FOUNDATION_TZ_LABEL}`;
}

/** "in 6 days" / "3 hours ago" — used for deadlines and queues. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return 'Not set';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'Not set';
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [1000 * 60 * 60 * 24 * 365, 'year'],
    [1000 * 60 * 60 * 24 * 30, 'month'],
    [1000 * 60 * 60 * 24, 'day'],
    [1000 * 60 * 60, 'hour'],
    [1000 * 60, 'minute'],
  ];
  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  for (const [ms, unit] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString('en-GB') : '0';
}

export function formatBytes(bytes: number | string | null | undefined): string {
  const b = Number(bytes ?? 0);
  if (!Number.isFinite(b) || b <= 0) return '0 KB';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function slugify(input: string, fallback = 'story'): string {
  const s = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return s || fallback;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Trim to a word boundary for cards and excerpts. */
export function truncate(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(' ', max) || max).trimEnd()}…`;
}

export function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}

/** Deadline copy that reads correctly whether the date is past or future. */
export function deadlineLabel(closesAt: string | Date | null | undefined): string {
  if (!closesAt) return 'No closing date set';
  const d = new Date(closesAt);
  if (Number.isNaN(d.getTime())) return 'No closing date set';
  return d.getTime() < Date.now()
    ? `Closed ${formatDate(d)}`
    : `Closes ${formatDate(d)} · ${relativeTime(d)}`;
}

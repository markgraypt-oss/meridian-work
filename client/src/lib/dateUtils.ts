/**
 * Returns a YYYY-MM-DD string using LOCAL date parts, not UTC.
 *
 * Use this instead of date.toISOString().split('T')[0] whenever you need
 * a date string for the current device day. toISOString() converts to UTC
 * first, which can return the wrong calendar day for users in UTC+ timezones
 * (e.g. BST = UTC+1: local midnight March 17 → UTC March 16 23:00 → wrong day).
 */
export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns YYYY-MM-DD for today using local device time. */
export function todayLocalStr(): string {
  return localDateStr(new Date());
}

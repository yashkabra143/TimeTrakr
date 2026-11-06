// Date parsing for CSV imports.
//
// Numeric dates like 12/10/2026 are ambiguous. Reading them as M/D silently put
// 12 Oct on 10 Dec, so the order is decided once per file: a first part over 12
// means D/M, a second part over 12 means M/D, and an all-ambiguous file is read
// as D/M (the usual order in India).

const NUMERIC = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/;

/** True when the file's numeric dates are day-first (D/M/YYYY). */
export function detectDayFirst(values: string[]): boolean {
  let sawDayFirst = false;
  let sawMonthFirst = false;
  for (const v of values) {
    const m = (v || "").trim().match(NUMERIC);
    if (!m) continue;
    if (Number(m[1]) > 12) sawDayFirst = true;
    if (Number(m[2]) > 12) sawMonthFirst = true;
  }
  if (sawMonthFirst && !sawDayFirst) return false;
  return true;
}

export function parseCsvDate(str: string, dayFirst = true): Date | null {
  const s = (str || "").trim();
  if (!s) return null;

  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(NUMERIC);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const rawYear = Number(m[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    // A part over 12 can only be the day, whatever the file's order.
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : dayFirst ? [a, b] : [b, a];
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) || d.getMonth() !== month - 1 || d.getDate() !== day ? null : d;
  }

  // Natural language / Upwork "Jun 19, 2026"
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** True when the date is after today (with a day of slack for time zones). */
export function isFutureDate(d: Date, now = new Date()): boolean {
  return d.getTime() > now.getTime() + 24 * 3600 * 1000;
}

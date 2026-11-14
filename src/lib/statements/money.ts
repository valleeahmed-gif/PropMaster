// Number and date recognition for South African statements.

export interface Amount {
  value: number;
  /** Character offsets within the source string. */
  start: number;
  end: number;
}

// 1,234.56 | 1 234.56 | 1234.56 | 1 234,56 | 1.234,56 — always exactly two decimals.
// Optional R prefix; negatives as -1,234.56 | 1,234.56- | (1,234.56) | 1,234.56 CR.
const MONEY_RE =
  /(?<![\w.,/-])(\(|-\s?)?(?:R\s?)?(-)?((?:\d{1,3}(?:[ ,.\u00a0]\d{3})+|\d+)[.,]\d{2})(?![\d])(?![.,]\d)(-(?![\d\w])|\)|\s?CR\b|\s?Cr\b)?/g;

// A number followed by one of these is a quantity, not money.
const UNIT_AFTER_RE = /^\s?(%|kwh|kw\b|kva|kl\b|kℓ|k[lℓ]\b|l\b|ℓ|m2|m²|m3|m³|days?\b|dae\b|units?\b|eenhede|c\/kwh|x\b)/i;

/** All money amounts in a string, left to right. */
export function findAmounts(s: string): Amount[] {
  const out: Amount[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(s))) {
    const after = s.slice(m.index + m[0].length);
    if (UNIT_AFTER_RE.test(after)) continue;
    // "@ R 2.12" style unit prices are rates, not line values.
    const before = s.slice(Math.max(0, m.index - 3), m.index);
    if (/@\s?$/.test(before)) continue;
    const raw = m[3];
    const digits = raw.slice(0, -3).replace(/[ ,. ]/g, '');
    const value = Number(`${digits}.${raw.slice(-2)}`);
    if (!Number.isFinite(value)) continue;
    // "(1,234.56)" is negative; a lone "(" just opens a bracketed expression.
    const openParen = m[1] === '(';
    const closeParen = m[4] === ')';
    const negative = Boolean((m[1] && !openParen) || m[2] || (m[4] && !closeParen) || (openParen && closeParen));
    let start = m.index;
    let end = m.index + m[0].length;
    if (openParen && !closeParen) start += 1;
    if (closeParen && !openParen) end -= 1;
    out.push({ value: negative ? -value : value, start, end });
  }
  return out;
}

/** The string with money amounts (and currency symbols) removed — what is left is the description. */
export function stripAmounts(s: string): string {
  let out = '';
  let pos = 0;
  for (const a of findAmounts(s)) {
    out += s.slice(pos, a.start) + ' ';
    pos = a.end;
  }
  out += s.slice(pos);
  return out.replace(/\bR\b(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const near = (a: number, b: number, tol = 0.06) => Math.abs(a - b) <= tol;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januarie: 1,
  feb: 2, february: 2, februarie: 2,
  mar: 3, march: 3, maart: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6, junie: 6,
  jul: 7, july: 7, julie: 7,
  aug: 8, august: 8, augustus: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, des: 12, desember: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const pad = (n: number) => String(n).padStart(2, '0');
const validYMD = (y: number, m: number, d: number) =>
  y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

export interface FoundDate { iso: string; start: number; end: number }

/** Dates in a string: 2026/07/06, 06/07/2026, 6 July 2026, 06-Jul-26 (day-first, as used in SA). */
export function findDates(s: string): FoundDate[] {
  const out: FoundDate[] = [];
  const push = (y: number, m: number, d: number, start: number, end: number) => {
    if (validYMD(y, m, d)) out.push({ iso: `${y}-${pad(m)}-${pad(d)}`, start, end });
  };
  let m: RegExpExecArray | null;
  const ymd = /(?<!\d)(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})(?!\d)/g;
  while ((m = ymd.exec(s))) push(+m[1], +m[2], +m[3], m.index, m.index + m[0].length);
  const dmy = /(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})(?![\d/.-])/g;
  while ((m = dmy.exec(s))) push(fullYear(+m[3]), +m[2], +m[1], m.index, m.index + m[0].length);
  const dMonY = new RegExp(`(?<!\\d)(\\d{1,2})[ -/.]?(${MONTH_NAMES})[a-z]*\\.?[ -/.,]{0,2}(20\\d{2}|\\d{2})(?!\\d)`, 'gi');
  while ((m = dMonY.exec(s))) push(fullYear(+m[3]), MONTHS[m[2].toLowerCase()], +m[1], m.index, m.index + m[0].length);
  return out.sort((a, b) => a.start - b.start);
}

/** "July 2026", "Jul-26", "2026/07" → { month, year }. */
export function findMonthYear(s: string): { month: number; year: number } | null {
  let m = new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\.?[ -/,']{0,3}(20\\d{2}|\\d{2})\\b`, 'i').exec(s);
  if (m) return { month: MONTHS[m[1].toLowerCase()], year: fullYear(+m[2]) };
  m = /(?<![\d/.-])(20\d{2})[/-](0[1-9]|1[0-2])(?![\d/.-])/.exec(s);
  if (m) return { month: +m[2], year: +m[1] };
  m = /(?<![\d/.-])(0[1-9]|1[0-2])[/-](20\d{2})(?![\d/.-])/.exec(s);
  if (m) return { month: +m[1], year: +m[2] };
  return null;
}

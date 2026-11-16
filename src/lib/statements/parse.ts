// Rule-based reader for South African municipal accounts (City of
// Johannesburg and similar) and body corporate / HOA levy statements.
//
// No AI involved: the statement text is scanned with two strategies and the
// result is cross-checked against the statement's own "current charges"
// total, so a misread shows up as a warning instead of a silent wrong number.
//
//   sections   — CoJ style. Each service (Property Rates, City Power,
//                Johannesburg Water, PIKITUP…) has a heading, detail lines,
//                a VAT line and a subtotal.
//   line items — table / transaction-list style used by most other
//                municipalities and by managing agents' levy statements.

import { ChargeCategory, Confidence, Line, ParsedItem, ParsedStatement, StatementKind } from './types';
import { CATEGORY_ORDER, classify, classifyReference, isRecoverable, isVatable, labelFor } from './classify';
import { findAmounts, findDates, findMonthYear, near, round2, stripAmounts } from './money';
import { formatCurrency } from '../../utils';

// ── Line predicates ─────────────────────────────────────────

const SUMMARY_RE = new RegExp([
  'previous (account )?balance', 'balance brought forward', 'brought forward', 'opening balance',
  'balance b/?f', 'balance c/?f', 'carried forward', 'closing balance', 'vorige balans', 'saldo',
  'sub\\s?-?total', 'total due', 'amount due', 'total (amount )?(due|payable|outstanding)', 'amount payable',
  'balance due', 'now due', 'current charges', 'total current', 'current (account|month)', 'vat\\s*@',
  'due date', 'instal?ment', '\\bdeposit\\b', 'total outstanding', 'totaal verskuldig',
  'bedrag betaalbaar', 'huidige heffings', 'overdue', '^\\W*arrears', 'please pay', 'remittance',
].join('|'), 'i');

const PAYMENT_RE = /payment|receipt|thank you|betaling|ontvang|credit note|reversal|refund|debit order|\beft\b|\bpaid\b|journal credit/i;

const READING_RE = /\b(start|end|previous|current|present|old|new)\s+reading|meter reading|\blesing\b/i;

// Debtor ageing row: "90 Days+ 0.00 60 Days 0.00 30 Days 0.00 Current …"
const AGEING_RE = /\b(30|60|90|120)\s?(\+\s?)?(days|dae)/gi;

const isSummaryLine = (text: string) =>
  SUMMARY_RE.test(text) || (text.match(AGEING_RE) || []).length >= 2;

/** Description part of a line, lower-cased, without amounts or bracketed notes. */
function describe(text: string): string {
  return stripAmounts(text).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Amounts that represent charges on a detail line (drops valuations and multiplicands). */
function chargeAmounts(text: string): number[] {
  return findAmounts(text)
    .filter(a => {
      const before = text.slice(Math.max(0, a.start - 22), a.start);
      const after = text.slice(a.end, a.end + 4);
      // "Market Value: R 1,280,000.00" / "first R300 000.00" are facts, not charges.
      const labelled = /(value|valuation|waarde|first|eerste)\s*([:=]\s*)?(of\s+)?(r\s?)?$/i.exec(before);
      if (labelled && a.value > 0 && (labelled[2] || labelled[4] || a.value >= 50000)) return false;
      if (/^\s*(x|\*|@)(\s|$)/i.test(after)) return false;
      return true;
    })
    .map(a => a.value);
}

// ── Section headings (CoJ style) ────────────────────────────

const HEADERS: { category: ChargeCategory; re: RegExp }[] = [
  { category: 'rates',            re: /^(property rates|assessment rates|rates(\s*(&|and)\s*taxes)?|eiendomsbelasting)\b/ },
  { category: 'electricity',      re: /^(city power|electricity|elektrisiteit)\b/ },
  { category: 'water_sanitation', re: /^(johannesburg water|water\s*(&|and|en)\s*(sanitation|sewer\w*|riool\w*))/ },
  { category: 'water',            re: /^water\b/ },
  { category: 'sewerage',         re: /^(sewer\w*|sanitation|riool\w*)\b/ },
  { category: 'refuse',           re: /^(pikitup|refuse|solid waste|waste (management|removal)|vullis\w*)\b/ },
  { category: 'gas',              re: /^gas\b/ },
  { category: 'sundry',           re: /^(sundr(y|ies)|other charges|miscellaneous)\b/ },
];
const NOT_HEADER_RE = /levy|charge|fee|tariff|step|consumption|basic|demand|service|network|surcharge|block|reading|meter|period|rebate|less\b|interest/;

function headerCategory(text: string): ChargeCategory | null {
  const d = describe(text).toLowerCase().replace(/[:\-–]+$/, '').trim();
  if (!d || d.length > 44) return null;
  if ((d.match(/\d/g) || []).length > 2) return null;
  for (const h of HEADERS) {
    const m = h.re.exec(d);
    if (!m) continue;
    const rest = d.slice(m[0].length).trim();
    if (rest.split(/\s+/).filter(Boolean).length > 2) return null;
    if (NOT_HEADER_RE.test(rest)) return null;
    return h.category;
  }
  return null;
}

const family = (c: ChargeCategory) => (c === 'water' || c === 'sewerage' || c === 'water_sanitation' ? 'water' : c);

interface Section {
  category: ChargeCategory;
  headerText: string;
  headerAmount: number | null;
  lines: string[];
}

interface SectionResult {
  total: number;
  /** Every subtotal printed in the section matched the detail lines above it. */
  confirmed: boolean;
  /** Other plausible totals (printed subtotal vs sum of detail lines) when they disagree. */
  alternatives: number[];
  /** The section printed its own VAT line, so its total already includes VAT. */
  hasVat: boolean;
}

/** Work out a section's total from its detail lines, VAT lines and printed subtotals. */
function sectionTotal(sec: Section): SectionResult {
  let total = 0;
  let block: number[] = [];
  let blockHasVat = false;
  let confirmed = true;
  let sawTotalLine = false;
  let lastSubtotal: number | null = null;
  let detailSum = 0;

  const closeBlock = (value: number) => { total += value; block = []; blockHasVat = false; };

  const entries = sec.lines
    .filter(t => !READING_RE.test(t))
    .map(t => {
      const amounts = chargeAmounts(t);
      const desc = describe(t);
      return {
        amounts, desc,
        value: amounts.length ? amounts[amounts.length - 1] : null,
        bare: amounts.length > 0 && desc.replace(/[^a-z]/gi, '').length === 0,
        totalLabel: /^\W*((sub\s?-?)?total|totaal|amount incl|incl(uding|\.)?\s*vat)/i.test(desc),
        vat: /\b(vat|btw)\b/i.test(desc),
      };
    })
    .filter(e => e.value !== null);
  const hasVat = entries.some(e => e.vat);

  entries.forEach((e, i) => {
    const value = e.value as number;
    const blockSum = block.reduce((s, v) => s + v, 0);
    if (e.bare || e.totalLabel) lastSubtotal = value; else detailSum += value;
    if (e.totalLabel) {
      if (block.length && !near(blockSum, value, 0.11)) confirmed = false;
      closeBlock(value);
      sawTotalLine = true;
      return;
    }
    if (e.bare) {
      const isLast = i === entries.length - 1;
      // A bare amount that equals the lines above it is that block's subtotal.
      if (block.length && near(blockSum, value, 0.11)) { closeBlock(value); sawTotalLine = true; return; }
      // Bare amount right after the VAT line at the end of the section: the
      // subtotal, even if a detail line above could not be read.
      if (isLast && blockHasVat) { confirmed = false; closeBlock(value); sawTotalLine = true; return; }
      // Unexplained bare amount: could be a wrapped line value or a subtotal
      // whose detail lines were misread. Count it, but mark the section unsure.
      confirmed = false;
    }
    if (e.vat) blockHasVat = true;
    block.push(value);
  });
  total += block.reduce((s, v) => s + v, 0);

  const alternativesFor = (chosen: number) =>
    [lastSubtotal, detailSum, sec.headerAmount]
      .filter((v): v is number => v !== null && v > 0.005 && !near(v, chosen, 0.011))
      .filter((v, i, arr) => arr.findIndex(o => near(o, v, 0.011)) === i);

  if (sec.headerAmount !== null) {
    if (entries.length === 0) return { total: sec.headerAmount, confirmed: true, alternatives: [], hasVat };
    if (near(sec.headerAmount, total, 0.11)) return { total: sec.headerAmount, confirmed: true, alternatives: [], hasVat };
    // Heading carried the total and the details did not add up: trust the heading.
    if (!sawTotalLine) return { total: sec.headerAmount, confirmed: false, alternatives: alternativesFor(sec.headerAmount), hasVat };
  }
  return { total, confirmed, alternatives: confirmed ? [] : alternativesFor(total), hasVat };
}

function readMeter(lines: string[]): Pick<ParsedItem, 'consumption' | 'readingType'> {
  const out: Pick<ParsedItem, 'consumption' | 'readingType'> = {};
  const text = lines.join('\n');
  const cons = /consumption\s*[:=]?\s*([\d][\d ,]*(?:\.\d+)?)\s*(kwh|kl|kℓ)/i.exec(text)
    || /(?:^|[\s(])([\d][\d,]*(?:\.\d+)?)\s*(kwh|kl|kℓ)\b/i.exec(text);
  if (cons) {
    const value = Number(cons[1].replace(/[ ,]/g, ''));
    if (Number.isFinite(value) && value > 0) {
      out.consumption = { value, unit: /kwh/i.test(cons[2]) ? 'kWh' : 'kl' };
    }
  }
  if (/\bestimat\w*|\bberaam\w*|type\s*[:=]?\s*e\b/i.test(text)) out.readingType = 'estimated';
  else if (/\bactual\b|\bwerklik\w*/i.test(text)) out.readingType = 'actual';
  return out;
}

interface Candidate {
  strategy: 'sections' | 'lineItems';
  items: ParsedItem[];
  /** All section subtotals checked out (sections strategy only). */
  confirmed: boolean;
  /** The utility charges already include VAT (VAT lines or a VAT column were printed per service). */
  vatInItems: boolean;
  notes: string[];
}

function makeItem(category: ChargeCategory, amount: number, label?: string): ParsedItem {
  return {
    label: label || labelFor(category), amount: round2(amount),
    isRecoverable: isRecoverable(category), vatable: isVatable(category), category,
  };
}

/** One item per charge line — used for "Sundry" blocks that list unrelated charges. */
function itemsPerLine(lines: string[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const t of lines) {
    if (READING_RE.test(t)) continue;
    const amounts = chargeAmounts(t);
    if (!amounts.length) continue;
    const desc = describe(t);
    if (desc.replace(/[^a-z]/gi, '').length < 3) continue;                 // a bare subtotal
    if (/^\W*((sub\s?-?)?total|totaal)|\b(vat|btw)\b/i.test(desc)) continue;
    const value = amounts[amounts.length - 1];
    if (value <= 0.005) continue;
    const category = classify(desc) ?? classifyReference(t) ?? 'sundry';
    out.push(makeItem(category, value, category === 'sundry' ? cleanLabel(desc) : undefined));
  }
  return out;
}

function parseSections(lines: Line[], targets: number[]): Candidate {
  const sections: Section[] = [];
  let cur: Section | null = null;

  const endsWithSubtotal = (sec: Section) => {
    for (let i = sec.lines.length - 1; i >= 0; i--) {
      const amounts = chargeAmounts(sec.lines[i]);
      if (!amounts.length) continue;
      const desc = describe(sec.lines[i]);
      return desc.replace(/[^a-z]/gi, '').length === 0 || /^\W*((sub\s?-?)?total|totaal)/i.test(desc);
    }
    return false;
  };

  for (const line of lines) {
    const text = line.text;
    const cat = headerCategory(text);
    if (cat) {
      const amounts = findAmounts(text);
      const headerAmount = amounts.length ? amounts[amounts.length - 1].value : null;
      // "Johannesburg Water" → "Water & Sanitation" → "Sewer" are one section
      // unless the previous part already printed its own subtotal.
      if (cur && family(cur.category) === family(cat) && headerAmount === null && !endsWithSubtotal(cur)) {
        if (cur.category !== cat && family(cat) === 'water') cur.category = 'water_sanitation';
        continue;
      }
      cur = { category: cat, headerText: text, headerAmount, lines: [] };
      sections.push(cur);
      continue;
    }
    if (isSummaryLine(text)) { cur = null; continue; }
    if (cur) cur.lines.push(text);
  }

  const notes: string[] = [];
  const results = sections.map(sectionTotal);
  let confirmed = results.every(r => r.confirmed);

  // When a section's detail lines and printed subtotal disagree (typically an
  // OCR slip such as a dropped minus sign), use the statement's own total to
  // decide which reading is right.
  const totalOf = (rs: SectionResult[]) => rs.reduce((s, r) => s + Math.max(r.total, 0), 0);
  const hits = (v: number) => targets.some(t => near(v, t, 1));
  const open = results.map((r, i) => (r.alternatives.length ? i : -1)).filter(i => i >= 0).slice(0, 6);
  if (targets.length && open.length && !hits(totalOf(results))) {
    const tryFrom = (k: number, acc: SectionResult[]): SectionResult[] | null => {
      if (k === open.length) return hits(totalOf(acc)) ? acc : null;
      const idx = open[k];
      for (const option of [results[idx].total, ...results[idx].alternatives]) {
        const next = acc.slice();
        next[idx] = { ...results[idx], total: option };
        const found = tryFrom(k + 1, next);
        if (found) return found;
      }
      return null;
    };
    const fixed = tryFrom(0, results);
    if (fixed) {
      fixed.forEach((r, i) => { results[i] = r; });
      confirmed = true;
      notes.push('One section had a line that did not add up; its printed subtotal was used, which matches the statement total.');
    }
  }

  const raw: { item: ParsedItem }[] = [];
  sections.forEach((sec, i) => {
    const res = results[i];
    if (res.total <= 0.005) return;
    // A "Sundry" / "Other charges" block lists unrelated charges: keep them apart.
    if (sec.category === 'sundry') {
      const split = itemsPerLine(sec.lines);
      if (split.length) {
        split.forEach(item => raw.push({ item }));
        return;
      }
    }
    const item = makeItem(sec.category, res.total);
    Object.assign(item, readMeter([sec.headerText, ...sec.lines]));
    raw.push({ item });
  });

  // The same service printed twice with the same amount (page-1 summary +
  // page-2 detail) is one charge, not two.
  const items: ParsedItem[] = [];
  for (const { item } of raw) {
    const dup = items.find(i => family(i.category) === family(item.category) && near(i.amount, item.amount, 0.011));
    if (dup) {
      if (!dup.consumption && item.consumption) dup.consumption = item.consumption;
      if (!dup.readingType && item.readingType) dup.readingType = item.readingType;
      continue;
    }
    items.push(item);
  }
  // Utilities already include VAT only if their sections printed VAT lines.
  const vatInItems = sections.some((sec, i) => isVatable(sec.category) && results[i].hasVat);
  return { strategy: 'sections', items, confirmed, vatInItems, notes };
}

// ── Line items (tables, transaction lists) ──────────────────

type ColumnRole = 'value' | 'credit' | 'balance' | 'vat' | 'excl';
interface Column { role: ColumnRole; x: number; x2: number }

function columnRole(cell: string): ColumnRole | null {
  const c = cell.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!c || c.length > 26) return null;
  if (/^(balance|running balance|saldo|balans)$/.test(c)) return 'balance';
  if (/^(credits?|payments?|receipts?|krediet|betalings?)$/.test(c)) return 'credit';
  if (/^(vat|btw)( amount)?$/.test(c)) return 'vat';
  if (/excl/.test(c)) return 'excl';
  if (/^(debits?|charges?|amount|total|debiet|bedrag|totaal|amount due|total incl|incl vat|amount incl vat|amount incl|total amount)( r| zar)?$/.test(c)) return 'value';
  return null;
}

function detectColumns(line: Line): Column[] | null {
  const cols: Column[] = [];
  for (const cell of line.cells) {
    // A header cell may hold several words ("Debit Credit Balance") when spacing is tight.
    const role = columnRole(cell.str);
    if (role) cols.push({ role, x: cell.x, x2: cell.x2 });
  }
  if (cols.length >= 2 || (cols.length === 1 && /description|details|beskrywing|transaction|date|datum/i.test(line.text))) return cols;
  return null;
}

function cleanLabel(desc: string): string {
  let d = desc;
  for (const f of findDates(d).reverse()) d = d.slice(0, f.start) + ' ' + d.slice(f.end);
  d = d.replace(/\b[A-Z]{0,4}\d{3,}[A-Z0-9/-]*\b/g, ' ')   // reference numbers
       .replace(/^[\W_]+|[\W_]+$/g, '')
       .replace(/\s+/g, ' ')
       .trim();
  if (!d || d.replace(/[^a-z]/gi, '').length < 3) return 'Other charge';
  d = d.length > 40 ? d.slice(0, 40).trim() : d;
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** Letters left in a description once dates and reference codes are removed. */
function meaningfulLetters(text: string): number {
  let d = describe(text);
  for (const f of findDates(d).reverse()) d = d.slice(0, f.start) + ' ' + d.slice(f.end);
  d = d.replace(/\b[A-Z]{0,5}\d{3,}[A-Z0-9/-]*\b/gi, ' ');
  return d.replace(/[^a-z]/gi, '').length;
}

/**
 * Some PDFs put a row's description on its own line above or below the
 * date / reference / amounts (wrapped table cells). Pair each such amount
 * row with the description line next to it.
 */
function pairDescriptions(lines: Line[], isHeader: (l: Line) => boolean): Map<number, string> {
  const amountRow = (l: Line) => findAmounts(l.text).length > 0 && meaningfulLetters(l.text) < 3 && !isSummaryLine(l.text);
  const textRow = (l: Line) => findAmounts(l.text).length === 0 && meaningfulLetters(l.text) >= 3
    && !isSummaryLine(l.text) && !isHeader(l) && !READING_RE.test(l.text);
  const close = (a: Line, b: Line) => a.page === b.page
    && (a.y === undefined || b.y === undefined || Math.abs(a.y - b.y) <= 1.7 * Math.max(a.h ?? 1, b.h ?? 1));

  const tryDir = (dir: 1 | -1) => {
    const used = new Set<number>();
    const pairs = new Map<number, string>();
    lines.forEach((l, i) => {
      if (!amountRow(l)) return;
      const j = i + dir;
      const n = lines[j];
      if (n && !used.has(j) && textRow(n) && close(l, n)) { used.add(j); pairs.set(i, n.text); }
    });
    return pairs;
  };
  const below = tryDir(1);
  const above = tryDir(-1);
  return below.size >= above.size ? below : above;
}

interface RawLineItem { item: ParsedItem; month: string | null }

function parseLineItems(lines: Line[], kind: StatementKind, period: { month: number; year: number } | undefined): Candidate {
  const notes: string[] = [];
  let columns: Column[] | null = null;
  let inTable = false;
  let vatColumn = false;
  const raw: RawLineItem[] = [];
  const isHeader = (l: Line) => !!detectColumns(l) && findAmounts(l.text).length === 0;
  const borrowed = pairDescriptions(lines, isHeader);

  lines.forEach((line, idx) => {
    const header = detectColumns(line);
    if (header && findAmounts(line.text).length === 0) {
      columns = header;
      inTable = true;
      if (header.some(c => c.role === 'vat' || c.role === 'excl')) vatColumn = true;
      return;
    }
    const text = borrowed.has(idx) ? `${borrowed.get(idx)}  ${line.text}` : line.text;

    if (isSummaryLine(text)) return;
    const desc = describe(text);
    if (desc.replace(/[^a-z]/gi, '').length < 3) return;
    if (READING_RE.test(text)) return;

    // Amounts with their x position (right edge of the cell they sit in).
    const found: { value: number; x2: number }[] = [];
    for (const cell of line.cells) {
      for (const a of findAmounts(cell.str)) found.push({ value: a.value, x2: cell.x2 });
    }
    if (found.length === 0) return;

    let value: number | null = null;
    let isCredit = false;

    const cols = columns as Column[] | null;
    if (cols && cols.length) {
      const byRole: Partial<Record<ColumnRole, number>> = {};
      for (const f of found) {
        let best: Column | null = null;
        let bestDist = Infinity;
        for (const c of cols) {
          const dist = Math.abs(c.x2 - f.x2);
          if (dist < bestDist) { bestDist = dist; best = c; }
        }
        if (best && byRole[best.role] === undefined) byRole[best.role] = f.value;
      }
      if (byRole.value !== undefined) value = byRole.value;
      else if (byRole.excl !== undefined) value = byRole.excl + (byRole.vat ?? 0);
      else if (byRole.credit !== undefined) isCredit = true;
    }
    if (value === null && !isCredit) {
      const v = found.map(f => f.value);
      if (v.length >= 3 && near(v[v.length - 3] + v[v.length - 2], v[v.length - 1], 0.06)) { value = v[v.length - 1]; vatColumn = true; } // excl + VAT = incl
      else if (v.length === 1) value = v[0];
      else value = kind === 'levy' ? v[0] : v[v.length - 1]; // levy: amount then running balance
    }

    if (isCredit || value === null) return;
    if (PAYMENT_RE.test(desc)) return;
    if (value <= 0.005) return;

    const named = meaningfulLetters(text) >= 3;
    const category = (named ? classify(desc) : null) ?? classifyReference(text);
    const dates = findDates(text);
    const month = dates.length ? dates[0].iso.slice(0, 7) : null;
    if (/\b(vat|btw)\b/i.test(desc) && !category) {
      raw.push({ item: makeItem('sundry', value, 'VAT'), month });
      return;
    }
    if (!category) {
      // Unknown description: only keep it when it is clearly a table row.
      if (!(inTable || month) || kind === 'municipal') return;
      const ref = /\b[A-Z]{1,5}\d{3,}[A-Z0-9/-]*\b/.exec(text)?.[0];
      const label = cleanLabel(desc);
      raw.push({ item: makeItem('sundry', value, label === 'Other charge' && ref ? `Other charge (${ref})` : label), month });
      return;
    }
    const item = makeItem(category, value);
    Object.assign(item, readMeter([text]));
    raw.push({ item, month });
  });

  // A transaction list may cover several months — keep only the statement's month.
  let kept = raw;
  const months = Array.from(new Set(raw.map(r => r.month).filter((m): m is string => !!m))).sort();
  if (months.length > 1) {
    const wanted = period ? `${period.year}-${String(period.month).padStart(2, '0')}` : null;
    const target = wanted && months.includes(wanted) ? wanted : months[months.length - 1];
    kept = raw.filter(r => r.month === null || r.month === target);
    const skipped = raw.length - kept.length;
    if (skipped > 0) {
      const [y, m] = target.split('-');
      notes.push(`This statement lists several months. Only charges dated ${m}/${y} were read; ${skipped} older line${skipped === 1 ? ' was' : 's were'} left out.`);
    }
  }
  return { strategy: 'lineItems', items: kept.map(r => r.item), confirmed: false, vatInItems: vatColumn, notes };
}

// ── Statement-level facts ───────────────────────────────────

const ISSUERS: { name: string; re: RegExp }[] = [
  { name: 'City of Johannesburg', re: /city of johannesburg|joburg\.org\.za|\bpikitup\b|johannesburg water/i },
  { name: 'City of Cape Town', re: /city of cape town|capetown\.gov\.za|stad kaapstad/i },
  { name: 'eThekwini Municipality', re: /ethekwini|durban\.gov\.za/i },
  { name: 'City of Tshwane', re: /city of tshwane|tshwane\.gov\.za/i },
  { name: 'City of Ekurhuleni', re: /ekurhuleni/i },
  { name: 'Nelson Mandela Bay', re: /nelson mandela bay/i },
  { name: 'Mangaung Metro', re: /mangaung/i },
  { name: 'Buffalo City', re: /buffalo city/i },
];

type SummaryRole = 'previous' | 'excl' | 'vat' | 'incl' | 'due';

/** What a summary label refers to, e.g. "Current Charges (Excl VAT)" → 'excl'. */
function summaryRole(label: string): SummaryRole | null {
  const l = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!l || l.length > 48) return null;
  if (/previous (account )?balance|balance brought forward|brought forward|opening balance|balance b\/?f|vorige balans|saldo oorgebring/.test(l)) return 'previous';
  if (/excl/.test(l) && /current|charges?|month|sub ?total|amount/.test(l)) return 'excl';
  if (/^\W*(plus\s*|add\s*)?(total\s*)?(vat|btw)\b/.test(l) && !/incl|excl|reg|no\b|number/.test(l)) return 'vat';
  if (/current charges?[^\n]*incl|total current|current (charges?|month'?s? (charges?|total))|total (charges|levies) (for )?(the |this )?(month|period)|huidige heffings/.test(l)) return 'incl';
  if (/total (amount )?(due|payable)|amount (due|payable)|balance due|total outstanding|closing balance|totaal verskuldig|bedrag betaalbaar/.test(l)) return 'due';
  return null;
}

/**
 * Summary printed as a table: a row of labels with the amounts on the next
 * row ("Previous Balance | Payments | Current Charges (Excl VAT) | VAT | Total Due").
 */
function readSummaryTable(lines: Line[]): Partial<Record<SummaryRole, number>> {
  const out: Partial<Record<SummaryRole, number>> = {};
  lines.forEach((line, i) => {
    if (findAmounts(line.text).length) return;
    const labels = line.cells.map(c => ({ c, role: summaryRole(c.str) })).filter(x => x.role);
    if (labels.length < 2) return;
    const next = lines[i + 1];
    if (!next || next.page !== line.page) return;
    const values = next.cells.flatMap(c => findAmounts(c.str).map(a => ({ value: a.value, x: c.x, x2: c.x2 })));
    if (values.length < labels.length) return;
    const mid = (a: { x: number; x2: number }) => (a.x + a.x2) / 2;
    for (const { c, role } of labels) {
      let best: typeof values[number] | null = null;
      let bestScore = -Infinity;
      for (const v of values) {
        const overlap = Math.min(c.x2, v.x2) - Math.max(c.x, v.x);
        const score = overlap > 0 ? 1000 + overlap : -Math.abs(mid(c) - mid(v));
        if (score > bestScore) { bestScore = score; best = v; }
      }
      if (best && out[role!] === undefined) out[role!] = best.value;
    }
  });
  return out;
}

function lastAmount(text: string): number | undefined {
  const a = findAmounts(text);
  return a.length ? a[a.length - 1].value : undefined;
}

interface Facts {
  kind: StatementKind;
  issuer?: string;
  accountNumber?: string;
  statementDate?: string;
  dueDate?: string;
  period?: { month: number; year: number };
  currentExcl?: number;
  currentIncl?: number;
  vat?: number;
  previousBalance?: number;
  totalDue?: number;
}

function readFacts(lines: Line[]): Facts {
  const facts: Facts = { kind: 'unknown' };
  const all = lines.map(l => l.text).join('\n');

  for (const i of ISSUERS) if (i.re.test(all)) { facts.issuer = i.name; break; }
  const count = (re: RegExp) => (all.match(re) || []).length;
  const levyScore = count(/body corporate|regspersoon|sectional title|deeltitel|home\s?owners|\bhoa\b|managing agent|bestuursagent|trustees|\bcsos\b|reserve fund|\blev(y|ies)\b|heffing/gi);
  const muniScore = count(/municipal|munisipal|city of|metro\b|property rates|tax invoice|stand no|\berf\b|pikitup|city power|refuse|sewer/gi);
  const strongLevy = /body corporate|regspersoon|home\s?owners'? association|\bhoa\b|managing agent|bestuursagent|sectional title scheme|\bcsos\b|reserve fund/i.test(all);
  if (facts.issuer) facts.kind = 'municipal';
  else if (strongLevy || levyScore > muniScore) facts.kind = 'levy';
  else if (muniScore > 0) facts.kind = 'municipal';
  if (!facts.issuer && facts.kind === 'municipal') {
    const m = /([A-Z][\w'’-]+(?: [A-Z][\w'’-]+){0,3}) (Local |Metropolitan |District )?Municipality/.exec(all);
    if (m) facts.issuer = m[0];
  }

  let exclIndex = -10;
  const vatCandidates: { idx: number; amount: number }[] = [];
  lines.forEach((line, idx) => {
    const t = line.text;
    const low = t.toLowerCase();
    const amount = lastAmount(t);

    if (amount !== undefined) {
      if (facts.previousBalance === undefined && /previous (account )?balance|balance brought forward|brought forward|opening balance|balance b\/?f|vorige balans|saldo oorgebring/.test(low)) {
        facts.previousBalance = amount;
      } else if (/current (charges?|account|month)[^\n]*excl|charges?\s*\(?excl/.test(low)) {
        if (facts.currentExcl === undefined) { facts.currentExcl = amount; exclIndex = idx; }
      } else if (/current charges?[^\n]*incl|total current|current (charges?|month'?s? (charges?|total))|total (charges|levies) (for )?(the |this )?(month|period)|huidige heffings/.test(low)) {
        if (facts.currentIncl === undefined) facts.currentIncl = amount;
      } else if (facts.vat === undefined && /^\W*(plus\s*|add\s*)?(total\s*)?(vat|btw)\b/.test(low) && !/reg|no\.|number/.test(low)) {
        vatCandidates.push({ idx, amount });
      } else if (facts.totalDue === undefined && /total (amount )?(due|payable)|amount (due|payable)|balance due|total outstanding|closing balance|totaal verskuldig|bedrag betaalbaar/.test(low)) {
        facts.totalDue = amount;
      }
    }

    if (!facts.accountNumber) {
      const m = /acc(?:ount|t)?\.?\s*(?:number|no|nr|num|#)\.?\s*[:#]?\s*([A-Z]{0,3}\d[\dA-Z/-]{4,18})/i.exec(t);
      if (m) facts.accountNumber = m[1];
    }
    const dates = findDates(t);
    if (dates.length) {
      if (!facts.dueDate && /due date|pay(ment)? (by|before|due)|payable (by|before)|betaal voor|vervaldatum/.test(low)) {
        facts.dueDate = dates[dates.length - 1].iso;
      } else if (!facts.statementDate && /(statement|invoice|tax invoice|staat)\s*(date|datum)|^\W*(date|datum)\b/.test(low) && !/reading|valuation|due/.test(low)) {
        facts.statementDate = dates[0].iso;
      }
    }
    if (!facts.period && /statement (for|month|period)|for the month|billing (month|period)|account (for|month)|levy (for|month)|period\s*[:=]|maand/.test(low)) {
      const my = findMonthYear(t.replace(/.*?(statement (for|month|period)|for the month|billing (month|period)|account (for|month)|levy (for|month)|period\s*[:=]|maand)/i, ''));
      if (my) facts.period = my;
    }
  });

  // VAT printed in the summary, next to the excl-VAT figure (not a per-service VAT line).
  const nearVat = vatCandidates.find(v => Math.abs(v.idx - exclIndex) <= 4);
  if (nearVat) facts.vat = nearVat.amount;

  // Summary laid out as a table.
  const table = readSummaryTable(lines);
  facts.previousBalance ??= table.previous;
  facts.currentExcl ??= table.excl;
  facts.vat ??= table.vat;
  facts.currentIncl ??= table.incl;
  facts.totalDue ??= table.due;

  // Fill in whichever of excl / VAT / incl can be derived from the other two.
  if (facts.vat === undefined && facts.currentExcl !== undefined && facts.currentIncl !== undefined) {
    const v = round2(facts.currentIncl - facts.currentExcl);
    if (v > 0 && v < facts.currentExcl * 0.2) facts.vat = v;
  }

  if (!facts.statementDate) {
    for (const line of lines.slice(0, 30)) {
      if (/reading|valuation|due|pay/i.test(line.text)) continue;
      const d = findDates(line.text);
      if (d.length) { facts.statementDate = d[0].iso; break; }
    }
  }
  if (!facts.period && facts.statementDate) {
    facts.period = { year: +facts.statementDate.slice(0, 4), month: +facts.statementDate.slice(5, 7) };
  }
  return facts;
}

// ── Putting it together ─────────────────────────────────────

const sum = (items: ParsedItem[]) => round2(items.reduce((s, i) => s + i.amount, 0));
const fmt = (n: number) => formatCurrency(n);

function aggregate(items: ParsedItem[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const it of items) {
    // Only merge repeats of a recognised service (e.g. two electricity meters);
    // unrecognised charges always stay on their own lines.
    const same = it.category === 'sundry' ? undefined : out.find(o => o.category === it.category && o.label === it.label);
    if (same) {
      same.amount = round2(same.amount + it.amount);
      if (same.consumption && it.consumption && same.consumption.unit === it.consumption.unit) {
        same.consumption = { ...same.consumption, value: same.consumption.value + it.consumption.value };
      } else if (!same.consumption && it.consumption) same.consumption = it.consumption;
      if (it.readingType === 'estimated') same.readingType = 'estimated';
      else if (!same.readingType) same.readingType = it.readingType;
    } else out.push({ ...it });
  }
  return out.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

/** Read a statement from its text lines. Pure and deterministic. */
export function parseStatement(lines: Line[], method: 'text' | 'ocr' = 'text'): ParsedStatement {
  const facts = readFacts(lines);
  const warnings: string[] = [];

  const targetIncl = facts.currentIncl
    ?? (facts.currentExcl !== undefined ? round2(facts.currentExcl + (facts.vat ?? 0)) : undefined);

  // Independent ways the statement states this month's charges. "Total due"
  // equals the current charges when the previous balance was paid in full,
  // and exceeds them by the previous balance when nothing was paid.
  const derived: number[] = [];
  if (facts.totalDue !== undefined && facts.totalDue > 0) {
    derived.push(facts.totalDue);
    if (facts.previousBalance && facts.previousBalance > 0 && facts.totalDue > facts.previousBalance) {
      derived.push(round2(facts.totalDue - facts.previousBalance));
    }
  }
  const targets = [targetIncl, facts.vat ? facts.currentExcl : undefined, ...(facts.kind === 'municipal' ? derived : [])]
    .filter((t): t is number => t !== undefined);
  const candidates: Candidate[] = [];
  if (facts.kind !== 'levy') candidates.push(parseSections(lines, targets));
  candidates.push(parseLineItems(lines, facts.kind, facts.period));

  // VAT printed as its own line item belongs on top of the vatable items.
  for (const c of candidates) {
    const vatItems = c.items.filter(i => i.label === 'VAT');
    if (!vatItems.length) continue;
    const vat = vatItems.reduce((s, i) => s + i.amount, 0);
    const vatable = c.items.filter(i => i.label !== 'VAT' && i.category !== 'rates' && i.category !== 'interest');
    const base = vatable.reduce((s, i) => s + i.amount, 0);
    if (base > 0 && vat / base > 0.1 && vat / base < 0.16) {
      const ratio = 1 + vat / base;
      vatable.forEach(i => { i.amount = round2(i.amount * ratio); });
      c.items = c.items.filter(i => i.label !== 'VAT');
      c.notes.push('VAT was shown separately and has been added to each service.');
    }
  }

  // ── VAT ────────────────────────────────────────────────
  // Some municipalities (City of Johannesburg among them) list each service
  // EXCLUDING VAT and show the VAT only in the summary. Landlords pay — and
  // recover — the VAT-inclusive amount, so VAT is added to the services
  // that carry it (electricity, water, sewer, refuse) whenever the totals
  // show the listed amounts are excl. VAT.
  const vatableBase = (items: ParsedItem[]) => items.filter(i => i.vatable).reduce((s, i) => s + i.amount, 0);
  const vatRatioFor = (items: ParsedItem[]) => {
    const base = vatableBase(items);
    if (facts.vat && base > 0) {
      const r = facts.vat / base;
      if (r > 0.1 && r < 0.16) return 1 + r;
    }
    return 1.15;
  };
  const withVat = (items: ParsedItem[]) => {
    const ratio = vatRatioFor(items);
    return items.map(i => (i.vatable ? { ...i, amount: round2(i.amount * ratio) } : { ...i }));
  };
  const inclTargets = [targetIncl, ...(facts.kind === 'municipal' ? derived : [])].filter((t): t is number => t !== undefined);
  const hitsIncl = (items: ParsedItem[]) => items.length > 0 && inclTargets.some(t => near(sum(items), t, 1));

  type Match = 'incl' | 'excl' | null;
  const matchOf = (c: Candidate): Match => {
    if (!c.items.length) return null;
    if (hitsIncl(c.items)) return 'incl';
    if (facts.currentExcl !== undefined && near(sum(c.items), facts.currentExcl, 1) && (facts.vat || inclTargets.length)) return 'excl';
    if (!c.vatInItems && hitsIncl(withVat(c.items))) return 'excl';
    return null;
  };
  const score = (c: Candidate) =>
    (matchOf(c) ? 100 : 0) + (c.strategy === 'sections' && c.confirmed && c.items.length ? 10 : 0)
    + (c.strategy === 'sections' && c.items.length >= 2 ? 5 : 0) + Math.min(c.items.length, 4);
  const best = candidates.slice().sort((a, b) => score(b) - score(a))[0];
  const match = best ? matchOf(best) : null;

  let items = best ? best.items : [];
  if (best) warnings.push(...best.notes);

  const vatRatio = round2(vatRatioFor(items) * 10000) / 10000;
  let vatAdded = false;
  const vatableNames = () => items.filter(i => i.vatable).map(i => i.label.toLowerCase());
  if (match === 'excl' && items.some(i => i.vatable)) {
    items = withVat(items);
    vatAdded = true;
    warnings.push(`This statement lists services excluding VAT. VAT has been added to ${vatableNames().join(', ')} so the amounts match what you were billed.`);
  } else if (
    match === null && facts.kind === 'municipal' && best && !best.vatInItems && items.some(i => i.vatable)
    && (facts.issuer === 'City of Johannesburg' || /excl(\.|uding|usive)?\s*(of\s*)?vat|vat\s*excl/i.test(lines.map(l => l.text).join('\n')))
  ) {
    // No totals to check against, but this municipality lists services ex VAT.
    items = withVat(items);
    vatAdded = true;
    warnings.push(`${facts.issuer ?? 'This municipality'} lists services excluding VAT, so 15% VAT has been added to ${vatableNames().join(', ')}. Switch it off below if this statement already includes VAT.`);
  }

  items = aggregate(items);
  const total = sum(items);

  let reconciled: boolean | null = null;
  if (items.length && targetIncl !== undefined) reconciled = near(total, targetIncl, 1);
  else if (items.length && facts.kind === 'levy' && facts.totalDue !== undefined && !facts.previousBalance) {
    reconciled = near(total, facts.totalDue, 1) ? true : null;
  }
  // The printed current-charges figure disagrees, but the items match the
  // amount due: the items are right and that one figure was misread.
  if (reconciled !== true && items.length && facts.kind === 'municipal' && derived.some(t => near(total, t, 1))) {
    reconciled = true;
    if (targetIncl !== undefined) warnings.push('The items match the total due on the statement.');
  }

  if (reconciled === false && targetIncl !== undefined) {
    warnings.push(`The items add up to ${fmt(total)} but the statement shows current charges of ${fmt(targetIncl)}. Check for a missing or misread line.`);
  }
  for (const it of items) {
    if (it.readingType === 'estimated') warnings.push(`${it.label} was billed on an ESTIMATED reading — the amount may be corrected on a later statement.`);
  }
  if (facts.previousBalance && facts.previousBalance > 0.005) {
    warnings.push(`The statement carries a previous balance of ${fmt(facts.previousBalance)}. Arrears and payments are not included in the items below.`);
  }
  if (items.some(i => i.category === 'interest')) {
    warnings.push('Interest was charged on this account (usually for late payment).');
  }

  let confidence: Confidence = 'low';
  if (items.length) {
    if (reconciled === true) confidence = 'high';
    else if (reconciled === null) confidence = best?.strategy === 'sections' && best.confirmed ? 'medium' : (facts.kind === 'unknown' ? 'low' : 'medium');
    if (method === 'ocr' && reconciled !== true) confidence = 'low';
  }
  if (method === 'ocr' && items.length) {
    warnings.push('This document was read with OCR (it is a scan or photo). Please check each amount against the statement.');
  }

  return {
    kind: facts.kind,
    issuer: facts.issuer,
    accountNumber: facts.accountNumber,
    statementDate: facts.statementDate,
    dueDate: facts.dueDate,
    period: facts.period,
    items,
    totals: {
      currentCharges: targetIncl,
      vat: facts.vat,
      previousBalance: facts.previousBalance,
      totalDue: facts.totalDue,
    },
    reconciled,
    vatAdded,
    vatRatio,
    confidence,
    warnings,
    method,
  };
}

import { describe, expect, it } from 'vitest';
import { linesFromText } from '../lines';
import { findAmounts, findDates, findMonthYear } from '../money';
import { parseStatement } from '../parse';
import * as fx from './fixtures';

const read = (text: string, method: 'text' | 'ocr' = 'text') => parseStatement(linesFromText(text), method);
const amounts = (r: ReturnType<typeof read>) => Object.fromEntries(r.items.map(i => [i.label, i.amount]));

describe('money', () => {
  const values = (s: string) => findAmounts(s).map(a => a.value);
  it('reads SA number formats', () => {
    expect(values('1,234.56')).toEqual([1234.56]);
    expect(values('R 1 234.56')).toEqual([1234.56]);
    expect(values('1 234,56')).toEqual([1234.56]);
    expect(values('R1.234,56')).toEqual([1234.56]);
    expect(values('0.00 12.50')).toEqual([0, 12.5]);
  });
  it('reads negatives in every common style', () => {
    expect(values('-215.40')).toEqual([-215.4]);
    expect(values('2,100.00-')).toEqual([-2100]);
    expect(values('(350.00)')).toEqual([-350]);
    expect(values('350.00 CR')).toEqual([-350]);
  });
  it('ignores quantities, tariffs and percentages', () => {
    expect(values('500.000 kWh @ R 2.1234 = R 1,061.70')).toEqual([1061.7]);
    expect(values('VAT: 15.00 %')).toEqual([]);
    expect(values('18.00 kl used')).toEqual([]);
    expect(values('(R 1,280,000.00 x R 0.0086160 / 12)')).toEqual([]);
    expect(values('2026/07/06')).toEqual([]);
  });
  it('reads dates day-first and ISO-style', () => {
    expect(findDates('Date 2026/07/06').map(d => d.iso)).toEqual(['2026-07-06']);
    expect(findDates('due 28/08/2026').map(d => d.iso)).toEqual(['2026-08-28']);
    expect(findDates('1 September 2026').map(d => d.iso)).toEqual(['2026-09-01']);
    expect(findMonthYear('Statement for July 2026')).toEqual({ month: 7, year: 2026 });
  });
});

describe('City of Johannesburg statement', () => {
  const r = read(fx.COJ);
  it('identifies the statement', () => {
    expect(r.kind).toBe('municipal');
    expect(r.issuer).toBe('City of Johannesburg');
    expect(r.accountNumber).toBe('550123456');
    expect(r.statementDate).toBe('2026-07-06');
    expect(r.dueDate).toBe('2026-07-21');
    expect(r.period).toEqual({ month: 7, year: 2026 });
  });
  it('extracts each service incl. VAT', () => {
    expect(amounts(r)).toEqual({
      'Electricity': 2468.49,
      'Water & Sanitation': 1074.94,
      'Refuse Removal': 356.5,
      'Rates': 703.64,
    });
  });
  it('reconciles to the statement total', () => {
    expect(r.totals.currentCharges).toBe(4603.57);
    expect(r.reconciled).toBe(true);
    expect(r.confidence).toBe('high');
  });
  it('marks who normally pays', () => {
    const rec = Object.fromEntries(r.items.map(i => [i.label, i.isRecoverable]));
    expect(rec).toEqual({ 'Electricity': true, 'Water & Sanitation': true, 'Refuse Removal': true, 'Rates': false });
  });
  it('captures meter consumption', () => {
    const elec = r.items.find(i => i.category === 'electricity')!;
    expect(elec.consumption).toEqual({ value: 623, unit: 'kWh' });
    expect(elec.readingType).toBe('actual');
    expect(r.items.find(i => i.category === 'water_sanitation')!.consumption).toEqual({ value: 18, unit: 'kl' });
  });
  it('does not include the previous balance or payments', () => {
    expect(r.items.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(4603.57, 2);
    expect(r.totals.previousBalance).toBe(4210.33);
  });
});

describe('City of Johannesburg edge cases', () => {
  it('flags estimated readings', () => {
    const r = read(fx.COJ_ESTIMATED);
    expect(r.items.find(i => i.category === 'electricity')!.readingType).toBe('estimated');
    expect(r.warnings.join(' ')).toMatch(/ESTIMATED/);
  });
  it('warns instead of guessing when a section is missing', () => {
    const r = read(fx.COJ_MISSING_SECTION);
    expect(r.reconciled).toBe(false);
    expect(r.confidence).toBe('low');
    expect(r.warnings.join(' ')).toMatch(/add up to/);
  });
  it('self-corrects a misread line using the printed subtotal and statement total', () => {
    const r = read(fx.COJ_LOST_MINUS, 'ocr');
    expect(r.items.find(i => i.category === 'rates')!.amount).toBe(703.64);
    expect(r.reconciled).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/printed subtotal/);
  });
  it('falls back to the total due when the current-charges figure is misread', () => {
    const r = read(fx.COJ_MISREAD_SUMMARY, 'ocr');
    expect(r.items.find(i => i.category === 'rates')!.amount).toBe(703.64);
    expect(r.items.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(4603.57, 2);
    expect(r.reconciled).toBe(true);
  });
  it('never reports OCR output as high confidence unless it reconciles', () => {
    expect(read(fx.COJ, 'ocr').confidence).toBe('high');
    expect(read(fx.COJ_MISSING_SECTION, 'ocr').confidence).toBe('low');
  });
});

describe('other municipal layouts', () => {
  it('reads a table with excl / VAT / total columns', () => {
    const r = read(fx.MUNICIPAL_TABLE);
    expect(r.issuer).toBe('City of Cape Town');
    expect(amounts(r)).toEqual({
      'Electricity': 1421.4, 'Water': 356.5, 'Sewerage': 249.55, 'Refuse Removal': 184, 'Rates': 812.4,
    });
    expect(r.reconciled).toBe(true);
    expect(r.period).toEqual({ month: 8, year: 2026 });
    expect(r.items.find(i => i.category === 'electricity')!.consumption).toEqual({ value: 412, unit: 'kWh' });
  });
  it('adds VAT when services are listed excluding VAT', () => {
    const r = read(fx.MUNICIPAL_EXCL);
    expect(r.reconciled).toBe(true);
    expect(amounts(r)).toEqual({ 'Electricity': 402.5, 'Water': 172.5, 'Refuse Removal': 115, 'Rates': 400 });
    expect(r.warnings.join(' ')).toMatch(/VAT has been added/);
  });
  it('reads Afrikaans labels and decimal commas', () => {
    const r = read(fx.MUNICIPAL_AFRIKAANS);
    expect(amounts(r)).toEqual({
      'Electricity': 1045.8, 'Water': 288.15, 'Sewerage': 190, 'Refuse Removal': 175.25, 'Rates': 612.3,
    });
    expect(r.reconciled).toBe(true);
    expect(r.period).toEqual({ month: 10, year: 2026 });
  });
});

describe('levy statements', () => {
  it('reads a managing-agent transaction list for the statement month only', () => {
    const r = read(fx.LEVY_TRANSACTIONS);
    expect(r.kind).toBe('levy');
    expect(r.period).toEqual({ month: 8, year: 2026 });
    expect(amounts(r)).toEqual({
      'Electricity': 905.75, 'Water': 398.2, 'Levy': 1850, 'Reserve Fund Levy': 277.5, 'CSOS Levy': 27, 'Interest': 21.55,
    });
    expect(r.warnings.join(' ')).toMatch(/several months/);
    expect(r.warnings.join(' ')).toMatch(/previous balance/);
  });
  it('ignores payments, balances and the running-balance column', () => {
    const r = read(fx.LEVY_TRANSACTIONS);
    expect(r.items.some(i => i.amount === 2184.5 || i.amount > 3000)).toBe(false);
  });
  it('marks utilities recoverable and levies owner-paid', () => {
    const r = read(fx.LEVY_TRANSACTIONS);
    expect(r.items.filter(i => i.isRecoverable).map(i => i.label).sort()).toEqual(['Electricity', 'Water']);
  });
  it('reads a simple HOA levy invoice', () => {
    const r = read(fx.LEVY_INVOICE);
    expect(r.kind).toBe('levy');
    expect(amounts(r)).toEqual({ 'Levy': 2450, 'Special Levy': 500, 'Security': 680 });
    expect(r.reconciled).toBe(true);
    expect(r.period).toEqual({ month: 9, year: 2026 });
  });
});

describe('unreadable input', () => {
  it('returns no items rather than inventing them', () => {
    const r = read('Dear owner,\nPlease find attached the minutes of the AGM.\nKind regards');
    expect(r.items).toEqual([]);
    expect(r.confidence).toBe('low');
  });
});

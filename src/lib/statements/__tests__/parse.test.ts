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

describe('reported: CoJ amounts listed excluding VAT', () => {
  it('reads a table-style summary and adds VAT to each utility', () => {
    const r = read(fx.COJ_EXCL_TABLE);
    expect(r.totals.currentCharges).toBe(4603.57);
    expect(r.totals.vat).toBe(508.69);
    expect(amounts(r)).toEqual({
      'Electricity': 2468.49, 'Water & Sanitation': 1074.94, 'Refuse Removal': 356.5, 'Rates': 703.64,
    });
    expect(r.vatAdded).toBe(true);
    expect(r.reconciled).toBe(true);
    expect(r.items.find(i => i.category === 'rates')!.vatable).toBe(false);
  });
  it('adds 15% VAT for CoJ even when the summary cannot be read', () => {
    const r = read(fx.COJ_EXCL_NO_SUMMARY);
    expect(r.vatAdded).toBe(true);
    expect(amounts(r)).toEqual({
      'Electricity': 2468.49, 'Water & Sanitation': 1074.94, 'Refuse Removal': 356.5, 'Rates': 703.64,
    });
    expect(r.warnings.join(' ')).toMatch(/excluding VAT/);
  });
  it('does not add VAT twice when sections already include it', () => {
    const r = read(fx.COJ);
    expect(r.vatAdded).toBe(false);
    expect(r.items.find(i => i.category === 'electricity')!.amount).toBe(2468.49);
  });
});

describe('reported: levy lines merged into "Sundry"', () => {
  it('takes descriptions that sit on the line below the amounts', () => {
    const r = read(fx.LEVY_SPLIT_ROWS);
    expect(amounts(r)).toEqual({ 'Water': 398.2, 'Levy': 1850, 'Reserve Fund Levy': 277.5, 'CSOS Levy': 27 });
    expect(r.items.some(i => i.label === 'Sundry')).toBe(false);
  });
  it('recognises rows from their reference codes alone', () => {
    const r = read(fx.LEVY_CODES_ONLY);
    expect(amounts(r)).toEqual({ 'Water': 398.2, 'Levy': 1850, 'Reserve Fund Levy': 277.5 });
  });
  it('keeps each charge under a "Sundry" heading separate', () => {
    const r = read(fx.LEVY_SUNDRY_BLOCK);
    expect(amounts(r)).toEqual({ 'Water': 412.8, 'Levy': 1600, 'Reserve Fund Levy': 240 });
    expect(r.reconciled).toBe(true);
  });
  it('never merges two unrecognised charges into one line', () => {
    const r = read(`
SUNSET VIEW BODY CORPORATE
Date          Description                 Debit        Balance
01/08/2026    Garden service              350.00         350.00
01/08/2026    Pool maintenance            420.00         770.00
`);
    expect(r.items.map(i => [i.label, i.amount])).toEqual([['Garden service', 350], ['Pool maintenance', 420]]);
  });
});

describe('real layout: WeconnectU body corporate statement', () => {
  const r = read(fx.WECONNECTU_STATEMENT);
  it('reads the invoice total as a levy line, labelled with the invoice number', () => {
    expect(r.kind).toBe('levy');
    expect(r.items.map(i => [i.label, i.amount])).toEqual([['Levy invoice INV04390', 3144.86]]);
  });
  it('explains that the split is on the invoice itself', () => {
    expect(r.warnings.join(' ')).toMatch(/INV04390.*one total.*upload the invoice/i);
  });
  it('uses the unit reference, not the bank account number', () => {
    expect(r.accountNumber).toBe('SAM001-U07');
  });
  it('uses the month the charge is dated, not the statement date', () => {
    expect(r.statementDate).toBe('2026-12-31');
    expect(r.period).toEqual({ month: 11, year: 2026 });
  });
  it('splits the items when the statement lists them', () => {
    const it2 = read(fx.WECONNECTU_ITEMISED);
    expect(amounts(it2)).toEqual({ 'Water': 477.86, 'Levy': 2400, 'Reserve Fund Levy': 240, 'CSOS Levy': 27 });
    expect(it2.items.find(i => i.category === 'water')!.isRecoverable).toBe(true);
  });
});

describe('full breakdown: every charge line separately', () => {
  const r = read(fx.COJ);
  const detail = (cat: string) => r.items.find(i => i.category === cat)!.details;
  const total = (d: { amount: number }[]) => Math.round(d.reduce((s, x) => s + x.amount, 0) * 100) / 100;

  it('splits electricity into consumption and each fixed charge', () => {
    const d = detail('electricity')!;
    expect(d.map(x => x.label)).toEqual(['Electricity consumption', 'Electricity – Service charge', 'Electricity – Network charge']);
    expect(total(d)).toBe(2468.49);                       // still adds up to the section total incl. VAT
    expect(d[0].amount).toBeCloseTo(1361.43 * 1.15, 1);   // steps 1 + 2 merged, VAT spread across lines
    expect(d[0].consumption).toEqual({ value: 623, unit: 'kWh' });
  });
  it('splits water from sewer', () => {
    const d = detail('water_sanitation')!;
    expect(d.map(x => [x.label, x.category])).toEqual([
      ['Water consumption', 'water'], ['Water Demand Management Levy', 'water'], ['Sewer monthly charge', 'sewerage'],
    ]);
    expect(total(d)).toBe(1074.94);
    expect(d.every(x => x.isRecoverable)).toBe(true);
  });
  it('keeps single-charge services and rates as one line', () => {
    expect(detail('refuse')).toBeUndefined();
    expect(detail('rates')).toBeUndefined();
  });
  it('breakdown lines carry VAT when the statement listed them excluding VAT', () => {
    const ex = read(fx.COJ_EXCL_TABLE);
    const d = ex.items.find(i => i.category === 'electricity')!.details!;
    expect(d.map(x => x.label)).toEqual(['Electricity consumption', 'Electricity – Service charge', 'Electricity – Network charge']);
    expect(total(d)).toBe(2468.49);
    const w = ex.items.find(i => i.category === 'water_sanitation')!.details!;
    expect(w.map(x => x.label)).toEqual(['Water consumption', 'Water Demand Management Levy', 'Sewer monthly charge']);
    expect(total(w)).toBe(1074.94);
  });
  it('does not offer a breakdown that would not add up', () => {
    const bad = read(fx.COJ_LOST_MINUS.replace('Service charge                                                                184.56', 'Service charge                                                                134.56'));
    expect(bad.items.find(i => i.category === 'electricity')!.details).toBeUndefined();
  });
  it('levy statements are already one line per charge', () => {
    const l = read(fx.LEVY_TRANSACTIONS);
    expect(l.items.every(i => !i.details)).toBe(true);
    expect(l.items.length).toBe(6);
  });
});

describe('real layout: City of Johannesburg rates + refuse account', () => {
  const r = read(fx.COJ_REAL_RATES_REFUSE);
  it('reads rates net of the R300 000 rebate, and refuse incl. VAT', () => {
    expect(amounts(r)).toEqual({ 'Refuse Removal': 300.15, 'Rates': 212.61 });
  });
  it('reconciles to the statement', () => {
    expect(r.totals.currentCharges).toBe(512.76);
    expect(r.reconciled).toBe(true);
    expect(r.confidence).toBe('high');
    expect(r.vatAdded).toBe(false);
  });
  it('identifies the statement', () => {
    expect(r.issuer).toBe('City of Johannesburg');
    expect(r.accountNumber).toBe('550000000');
    expect(r.period).toEqual({ month: 11, year: 2026 });
    expect(r.dueDate).toBe('2026-11-25');
  });
  it('does not warn about arrears when the previous balance was paid', () => {
    expect(r.warnings.join(' ')).not.toMatch(/previous balance/);
  });
  it('still warns when part of the previous balance is unpaid', () => {
    const owing = read(fx.COJ_REAL_RATES_REFUSE.replace('- 512.76', '- 200.00').replace(/Sub Total(\s+)0\.00/, 'Sub Total$1312.76'));
    expect(owing.warnings.join(' ')).toMatch(/R\s?312[.,]76 from earlier statements is still unpaid/);
  });
});

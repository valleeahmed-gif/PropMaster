import { describe, expect, it } from 'vitest';
import { buildInvoiceDraft, dueDateFor, invoiceForMonth, isRentDue, leaseCoversMonth, taxYearOf, taxYearRange } from '../billing';
import { Invoice, Lease, PropertyCost, UtilityBreakdown } from '../../types';

const lease = (over: Partial<Lease> = {}): Lease => ({
  id: 'L1', propertyId: 'P1', tenantId: 'T1', ownerId: 'U', leaseType: 'fixed_term',
  startDate: '2026-01-15', endDate: '2026-12-31', rentFrequency: 'monthly', dueDay: 1,
  rentAmount: 12500, depositPaid: 25000, status: 'active', createdAt: '', ...over,
});

describe('dueDateFor', () => {
  it('uses the lease due day', () => expect(dueDateFor(11, 2026, 3)).toBe('2026-11-03'));
  it('clamps to short months', () => {
    expect(dueDateFor(2, 2026, 31)).toBe('2026-02-28');
    expect(dueDateFor(2, 2028, 30)).toBe('2028-02-29');
  });
  it('defaults to the 1st', () => expect(dueDateFor(6, 2026)).toBe('2026-06-01'));
});

describe('lease coverage and rent frequency', () => {
  it('does not bill before the lease starts', () => {
    expect(leaseCoversMonth(lease(), 12, 2025)).toBe(false);
    expect(leaseCoversMonth(lease(), 1, 2026)).toBe(true);
  });
  it('keeps billing an active lease after its end date (month to month)', () => {
    expect(leaseCoversMonth(lease(), 2, 2027)).toBe(true);
    expect(leaseCoversMonth(lease({ status: 'ended' }), 2, 2027)).toBe(false);
  });
  it('bills monthly leases every month', () => expect(isRentDue(lease(), 7, 2026)).toBe(true));
  it('bills quarterly leases every third month from the start', () => {
    const q = lease({ rentFrequency: 'quarterly', startDate: '2026-02-01' });
    expect([2, 3, 4, 5, 8, 11].map(m => isRentDue(q, m, 2026))).toEqual([true, false, false, true, true, true]);
    expect(isRentDue(q, 2, 2027)).toBe(true);
  });
  it('bills yearly leases once a year', () => {
    const y = lease({ rentFrequency: 'yearly', startDate: '2026-03-01' });
    expect(isRentDue(y, 3, 2026)).toBe(true);
    expect(isRentDue(y, 4, 2026)).toBe(false);
    expect(isRentDue(y, 3, 2027)).toBe(true);
  });
});

describe('buildInvoiceDraft', () => {
  const costs: PropertyCost[] = [{ id: 'C1', propertyId: 'P1', ownerId: 'U', month: 11, year: 2026, totalAmount: 3400, createdAt: '' }];
  const bds: UtilityBreakdown[] = [
    { id: 'b1', propertyCostId: 'C1', label: 'Electricity', amount: 1100, isRecoverable: true, isRecurring: false, createdAt: '' },
    { id: 'b2', propertyCostId: 'C1', label: 'Water & Sanitation', amount: 450.555, isRecoverable: true, isRecurring: false, createdAt: '' },
    { id: 'b3', propertyCostId: 'C1', label: 'Levy', amount: 1850, isRecoverable: false, isRecurring: true, createdAt: '' },
  ];
  it('adds rent and only the recoverable costs', () => {
    const d = buildInvoiceDraft(lease(), 11, 2026, costs, bds);
    expect(d.lineItems).toEqual([
      { description: 'Monthly Rent — November 2026', amount: 12500 },
      { description: 'Electricity recovery', amount: 1100 },
      { description: 'Water & Sanitation recovery', amount: 450.56 },
    ]);
    expect(d.totalAmount).toBe(14050.56);
    expect(d.recoveryCount).toBe(2);
    expect(d.hasCostsForMonth).toBe(true);
  });
  it('is rent only when no costs were captured', () => {
    const d = buildInvoiceDraft(lease(), 10, 2026, costs, bds);
    expect(d.lineItems).toHaveLength(1);
    expect(d.hasCostsForMonth).toBe(false);
  });
  it('bills only recoveries in a month when quarterly rent is not due', () => {
    const d = buildInvoiceDraft(lease({ rentFrequency: 'quarterly', startDate: '2026-09-01' }), 11, 2026, costs, bds);
    expect(d.rentIncluded).toBe(false);
    expect(d.totalAmount).toBe(1550.56);
  });
});

describe('invoiceForMonth', () => {
  const inv = (over: Partial<Invoice>): Invoice => ({
    id: 'i', propertyId: 'P1', leaseId: 'L1', ownerId: 'U', invoiceNumber: 'INV-2026-001', month: 11, year: 2026,
    dueDate: '2026-11-01', lineItems: [], totalAmount: 1, status: 'sent', createdAt: '', ...over,
  });
  it('finds a live invoice and ignores cancelled ones', () => {
    expect(invoiceForMonth([inv({})], 'L1', 11, 2026)).toBeTruthy();
    expect(invoiceForMonth([inv({ status: 'cancelled' })], 'L1', 11, 2026)).toBeUndefined();
    expect(invoiceForMonth([inv({})], 'L1', 10, 2026)).toBeUndefined();
  });
});

describe('SARS tax year', () => {
  it('runs March to February', () => {
    expect(taxYearRange(2027)).toEqual({ fromMonth: 3, fromYear: 2026, toMonth: 2, toYear: 2027 });
    expect(taxYearOf(11, 2026)).toBe(2027);
    expect(taxYearOf(2, 2026)).toBe(2026);
    expect(taxYearOf(3, 2026)).toBe(2027);
  });
});

import { buildAccountStatement } from '../billing';

describe('buildAccountStatement', () => {
  const inv = (id: string, n: string, month: number, due: string, total: number, status: Invoice['status'] = 'sent'): Invoice => ({
    id, propertyId: 'P1', leaseId: 'L1', ownerId: 'U', invoiceNumber: n, month, year: 2026,
    dueDate: due, lineItems: [], totalAmount: total, status, createdAt: '',
  });
  const invoices = [
    inv('i1', 'INV-2026-001', 9, '2026-09-01', 12500, 'paid'),
    inv('i2', 'INV-2026-002', 10, '2026-10-01', 13000, 'partial'),
    inv('i3', 'INV-2026-003', 11, '2026-11-01', 12500, 'draft'),
    { ...inv('i4', 'INV-2026-004', 10, '2026-10-01', 999), leaseId: 'OTHER' },
  ];
  const pay = (invoiceId: string | undefined, date: string, amount: number, status = 'verified') =>
    ({ leaseId: 'L1', invoiceId, amount, paymentDate: date, method: 'bank_transfer', status });
  const payments = [pay('i1', '2026-09-03', 12500), pay('i2', '2026-10-01', 5000), pay('i2', '2026-10-20', 1000, 'pending')];

  const s = buildAccountStatement('L1', invoices, payments);
  it('lists invoices and verified payments oldest first with a running balance', () => {
    expect(s.rows.map(r => [r.date, r.charge, r.payment, r.balance])).toEqual([
      ['2026-09-01', 12500, 0, 12500],
      ['2026-09-03', 0, 12500, 0],
      ['2026-10-01', 13000, 0, 13000],
      ['2026-10-01', 0, 5000, 8000],
    ]);
  });
  it('excludes drafts, other leases and unverified payments', () => {
    expect(s.charged).toBe(25500);
    expect(s.paid).toBe(17500);
    expect(s.balance).toBe(8000);
  });
  it('names the invoice a payment was for', () => {
    expect(s.rows[1].description).toBe('Payment received (EFT) — INV-2026-001');
  });
});

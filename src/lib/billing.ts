// Billing rules shared by the invoice wizard, bulk invoicing and the dashboard.
import { Invoice, InvoiceLineItem, Lease, PropertyCost, UtilityBreakdown } from '../types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const INTERVAL: Record<Lease['rentFrequency'], number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };
const RENT_LABEL: Record<Lease['rentFrequency'], string> = {
  monthly: 'Monthly Rent', quarterly: 'Quarterly Rent', half_yearly: 'Half-Yearly Rent', yearly: 'Annual Rent',
};

/** Due date for a billing month: the lease's due day, clamped to the month's length. */
export function dueDateFor(month: number, year: number, dueDay?: number): string {
  const last = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(dueDay || 1, 1), last);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Due date for a lease's invoice in a billing month. Never earlier than the
 * lease start — a lease that begins mid-month must not be born overdue.
 */
export function dueDateForLease(lease: Pick<Lease, 'dueDay' | 'startDate'>, month: number, year: number): string {
  const due = dueDateFor(month, year, lease.dueDay);
  return lease.startDate && lease.startDate > due && lease.startDate.slice(0, 7) === due.slice(0, 7) ? lease.startDate : due;
}

/** Whether the lease is running at any point in the given month. */
export function leaseCoversMonth(lease: Lease, month: number, year: number): boolean {
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  if (lease.startDate && lease.startDate > last) return false;
  // An expired fixed-term lease that is still marked active continues month to month.
  if (lease.status !== 'active' && lease.endDate && lease.endDate < first) return false;
  return true;
}

/** Whether rent falls due in the given month (quarterly / yearly leases skip months). */
export function isRentDue(lease: Lease, month: number, year: number): boolean {
  if (!leaseCoversMonth(lease, month, year)) return false;
  const interval = INTERVAL[lease.rentFrequency] ?? 1;
  if (interval === 1 || !lease.startDate) return true;
  const startY = Number(lease.startDate.slice(0, 4));
  const startM = Number(lease.startDate.slice(5, 7));
  const diff = (year - startY) * 12 + (month - startM);
  return diff >= 0 && diff % interval === 0;
}

export interface InvoiceDraft {
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  rentIncluded: boolean;
  /** Recoverable running-cost lines added from that month's costs. */
  recoveryCount: number;
  /** A running-costs record exists for the month (even if nothing is recoverable). */
  hasCostsForMonth: boolean;
}

/** Rent (when due) plus that month's recoverable running costs for a lease. */
export function buildInvoiceDraft(
  lease: Lease, month: number, year: number,
  propertyCosts: PropertyCost[], utilityBreakdowns: UtilityBreakdown[],
): InvoiceDraft {
  const lineItems: InvoiceLineItem[] = [];
  const rentIncluded = isRentDue(lease, month, year);
  if (rentIncluded) {
    lineItems.push({
      description: `${RENT_LABEL[lease.rentFrequency] ?? 'Rent'} — ${MONTH_NAMES[month - 1]} ${year}`,
      amount: round2(lease.rentAmount),
    });
  }
  const cost = propertyCosts.find(c => c.propertyId === lease.propertyId && c.month === month && c.year === year);
  const recoveries = cost ? utilityBreakdowns.filter(b => b.propertyCostId === cost.id && b.isRecoverable && b.amount > 0) : [];
  for (const b of recoveries) lineItems.push({ description: `${b.label} recovery`, amount: round2(b.amount) });
  return {
    lineItems,
    totalAmount: round2(lineItems.reduce((s, l) => s + l.amount, 0)),
    rentIncluded,
    recoveryCount: recoveries.length,
    hasCostsForMonth: !!cost,
  };
}

/** The live (non-cancelled) invoice for a lease and billing month, if any. */
export function invoiceForMonth(invoices: Invoice[], leaseId: string, month: number, year: number): Invoice | undefined {
  return invoices.find(i => i.leaseId === leaseId && i.month === month && i.year === year && i.status !== 'cancelled');
}

/** SARS year of assessment: 1 March – end of February. `endYear` is the year it ends in. */
export function taxYearRange(endYear: number) {
  return { fromMonth: 3, fromYear: endYear - 1, toMonth: 2, toYear: endYear };
}

/** The tax year a given month falls in (returns the year it ends in). */
export function taxYearOf(month: number, year: number): number {
  return month >= 3 ? year + 1 : year;
}

// ── Tenant account statement ────────────────────────────────

export interface StatementRow {
  date: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
}

export interface AccountStatement {
  rows: StatementRow[];
  charged: number;
  paid: number;
  /** Positive = tenant owes; negative = tenant is in credit. */
  balance: number;
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'EFT', eft: 'EFT', cash: 'Cash', cheque: 'Cheque', payfast: 'PayFast', other: 'Payment',
};

/**
 * Everything billed to and received from a tenant on one lease, oldest
 * first, with a running balance. Drafts and cancelled invoices are left out;
 * only verified payments count.
 */
export function buildAccountStatement(
  leaseId: string,
  invoices: Invoice[],
  payments: { leaseId?: string; invoiceId?: string; amount: number; paymentDate: string; method: string; status: string; notes?: string }[],
): AccountStatement {
  const leaseInvoices = invoices.filter(i => i.leaseId === leaseId && i.status !== 'draft' && i.status !== 'cancelled');
  const invoiceIds = new Set(leaseInvoices.map(i => i.id));
  const leasePayments = payments.filter(p => p.status === 'verified' && (p.leaseId === leaseId || (p.invoiceId && invoiceIds.has(p.invoiceId))));

  type Entry = Omit<StatementRow, 'balance'> & { order: number };
  const entries: Entry[] = [
    ...leaseInvoices.map(i => ({
      date: i.dueDate, order: 0,
      description: `Invoice ${i.invoiceNumber} — ${MONTH_NAMES[i.month - 1]} ${i.year}`,
      charge: round2(i.totalAmount), payment: 0,
    })),
    ...leasePayments.map(p => {
      const inv = p.invoiceId ? leaseInvoices.find(i => i.id === p.invoiceId) : undefined;
      return {
        date: p.paymentDate, order: 1,
        description: `Payment received (${METHOD_LABEL[p.method] ?? 'Payment'})${inv ? ` — ${inv.invoiceNumber}` : ''}`,
        charge: 0, payment: round2(p.amount),
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  let balance = 0;
  const rows = entries.map(({ order: _order, ...e }) => {
    balance = round2(balance + e.charge - e.payment);
    return { ...e, balance };
  });
  return {
    rows,
    charged: round2(rows.reduce((s, r) => s + r.charge, 0)),
    paid: round2(rows.reduce((s, r) => s + r.payment, 0)),
    balance,
  };
}

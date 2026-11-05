// ── App deployment URL ──────────────────────────────────────
// Used for tenant invite magic links. Defaults to the origin the app is
// served from, so it follows custom domains / preview deploys automatically.
// Set VITE_APP_URL to pin it. The URL must be listed under Supabase →
// Authentication → URL Configuration → Redirect URLs.
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://propmaster.valleeahmed.workers.dev');

export function generateId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Readable message from a Supabase/PostgREST or JS error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong — please try again'): string {
  const msg = (err as { message?: unknown })?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

/** Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toLocalISODate(new Date());
}

/** Whole days from today to a YYYY-MM-DD date (negative = in the past). */
export function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

/** "YYYY-MM" key for a month/year, comparable as a string. */
export function monthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Derive an invoice's status from its stored status, total, verified
 * payments and due date. Drafts and cancelled invoices are left alone.
 */
export function deriveInvoiceStatus<S extends string>(
  stored: S, totalAmount: number, totalPaid: number, dueDate: string | undefined,
): S | 'paid' | 'partial' | 'overdue' | 'sent' {
  if (stored === 'draft' || stored === 'cancelled') return stored;
  if (totalPaid > 0 && totalPaid + 0.005 >= totalAmount) return 'paid';
  if (stored === 'paid' && totalPaid === 0) return 'paid'; // marked paid manually
  if (dueDate && dueDate < today()) return 'overdue';
  if (totalPaid > 0) return 'partial';
  return 'sent';
}

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) amount = 0;
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonthYear(month: number, year: number): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[month - 1]} ${year}`;
}

export const PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Free State',
  'Northern Cape',
] as const;

export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': case 'paid': case 'verified': case 'resolved': case 'accepted': return 'badge-green';
    case 'sent': case 'pending': case 'in_progress': return 'badge-amber';
    case 'overdue': case 'failed': return 'badge-red';
    case 'closed': return 'badge-gray';
    case 'draft': case 'ended': case 'open': return 'badge-gray';
    default: return 'badge-gray';
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'badge-red';
    case 'high': return 'badge-amber';
    case 'medium': return 'badge-blue';
    case 'low': return 'badge-gray';
    default: return 'badge-gray';
  }
}

export function currentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// ── Capture-form option lists ───────────────────────────────
export const PROPERTY_CATEGORIES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial',  label: 'Commercial' },
  { value: 'industrial',  label: 'Industrial' },
];

export const PROPERTY_TYPES = [
  { value: 'apartment',       label: 'Apartment' },
  { value: 'bungalow',        label: 'Bungalow' },
  { value: 'cluster',         label: 'Cluster' },
  { value: 'complex',         label: 'Complex' },
  { value: 'cottage',         label: 'Cottage' },
  { value: 'farm',            label: 'Farm' },
  { value: 'small_holding',   label: 'Small holding' },
  { value: 'flat',            label: 'Flat' },
  { value: 'house',           label: 'House' },
  { value: 'retirement',      label: 'Retirement' },
  { value: 'room',            label: 'Room' },
  { value: 'townhouse',       label: 'Townhouse' },
  { value: 'sectional_title', label: 'Sectional title' },
  { value: 'freehold',        label: 'Freehold' },
];

export const BATHROOM_TYPES = [
  { value: 'shower_only',   label: 'Shower only' },
  { value: 'ensuite',       label: 'Ensuite' },
  { value: 'shower_on_tub', label: 'Shower on tub' },
];

export const CUSTOMER_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'business',   label: 'Business' },
];

export const LEASE_TYPES = [
  { value: 'fixed_term',     label: 'Fixed Term Lease' },
  { value: 'month_to_month', label: 'Month-to-Month' },
];

export const RENT_FREQUENCIES = [
  { value: 'monthly',     label: 'Monthly' },
  { value: 'quarterly',   label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly',      label: 'Yearly' },
];

export const DUE_DAYS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

// Human-readable label lookups for the capture enums.
export function labelFor(list: { value: string; label: string }[], value?: string): string {
  return list.find(o => o.value === value)?.label ?? '—';
}

/**
 * Compute a lease end date from a start date + duration in months.
 * The lease runs to the day BEFORE the same date N months later
 * (e.g. 1 Jan + 12 months → 31 Dec). Returns '' if inputs are incomplete.
 */
export function computeLeaseEndDate(startDate: string, durationMonths: number): string {
  if (!startDate || !durationMonths || durationMonths <= 0) return '';
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  // Same day-of-month N months later (clamped to month end), minus one day.
  const targetMonthStart = new Date(y, m - 1 + durationMonths, 1);
  const lastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const end = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(d, lastDay));
  end.setDate(end.getDate() - 1);
  return toLocalISODate(end);
}

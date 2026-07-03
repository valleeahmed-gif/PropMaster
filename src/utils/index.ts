// ── App deployment URL ──────────────────────────────────────
// IMPORTANT: update this when you change hosting providers or custom domains.
// Used for tenant invite magic links and copy-link fallbacks.
export const APP_URL = 'https://propmaster.valleeahmed.workers.dev';

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonthYear(month: number, year: number): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[month - 1]} ${year}`;
}

export function formatInvoiceNumber(n: number): string {
  return `INV-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`;
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
    case 'overdue': case 'failed': case 'closed': return 'badge-red';
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
  const start = new Date(startDate + 'T00:00:00');
  if (isNaN(start.getTime())) return '';
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);
  end.setDate(end.getDate() - 1);
  return end.toISOString().split('T')[0];
}

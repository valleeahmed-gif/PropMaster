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

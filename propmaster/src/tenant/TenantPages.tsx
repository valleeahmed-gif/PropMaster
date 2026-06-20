import React, { useState } from 'react';
import {
  Building2, Calendar, CreditCard, FileText, Wrench, CheckCircle, Clock,
  AlertCircle, Plus, ChevronDown, ChevronUp, RotateCcw, Sparkles
} from 'lucide-react';
import { useTenant } from './TenantContext';
import { Modal, Field, Select, EmptyState } from '../components/UI';
import { Skeleton } from '../components/Skeleton';
import { formatCurrency, formatDate, formatMonthYear } from '../utils';
import { Invoice } from '../types';

// ── Shared micro-components ────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xs font-bold text-ink-500 uppercase tracking-widest mb-3 px-1">
      {children}
    </h2>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-semibold text-ink-900 text-right">{value}</span>
    </div>
  );
}

// Common error/empty state shell
function StateCard({ icon, title, message, action }: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-8 text-center mt-6">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p className="font-bold text-ink-900 mb-1.5">{title}</p>
      <p className="text-sm text-ink-500 leading-relaxed max-w-sm mx-auto">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ── Home Page ──────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
export function TenantHomePage() {
  const {
    tenantRecord, activeLease, property, invoices, maintenanceRequests,
    dataLoading, initialized, loadError, refreshData
  } = useTenant();

  // Initial load — proper skeleton
  if (dataLoading && !initialized) return <HomeLoading />;

  // Error state — actionable retry
  if (loadError) {
    return (
      <StateCard
        icon={<AlertCircle size={24} className="text-red-500" />}
        title="Couldn't load your data"
        message={loadError}
        action={
          <button onClick={() => refreshData()} className="btn-secondary">
            <RotateCcw size={14} /> Try again
          </button>
        }
      />
    );
  }

  // No tenant record — shouldn't happen if RLS is correct
  if (!tenantRecord) {
    return (
      <StateCard
        icon={<Building2 size={24} className="text-ink-400" />}
        title="Account not set up"
        message="We couldn't find your tenant profile. Please ask your landlord to set you up."
      />
    );
  }

  // Tenant linked but no active lease — landlord hasn't created it yet
  if (!activeLease || !property) {
    return (
      <div className="space-y-5">
        <WelcomeCard name={tenantRecord.name} property={null} />
        <StateCard
          icon={<Calendar size={24} className="text-ink-400" />}
          title="No active lease yet"
          message="Your landlord hasn't set up your lease yet. You'll see your property, invoices, and payments here once they do."
        />
      </div>
    );
  }

  // Happy path
  const unpaidInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue');
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const openMaintenance = maintenanceRequests.filter(m => m.status === 'open' || m.status === 'in_progress');
  const daysToLeaseEnd = activeLease.endDate
    ? Math.ceil((new Date(activeLease.endDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-5">
      <WelcomeCard name={tenantRecord.name} property={property} />

      {/* Outstanding alert */}
      {unpaidInvoices.length > 0 && (
        <button
          onClick={() => window.location.hash = '/tenant/invoices'}
          className="card p-4 border-amber-200 bg-amber-50/60 flex items-start gap-3 w-full text-left hover:bg-amber-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {formatCurrency(totalOutstanding)} outstanding
            </p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              {unpaidInvoices.length === 1 ? '1 invoice needs attention' : `${unpaidInvoices.length} invoices need attention`}
            </p>
          </div>
        </button>
      )}

      {/* Lease expiry warning */}
      {daysToLeaseEnd !== null && daysToLeaseEnd <= 60 && daysToLeaseEnd > 0 && (
        <div className="card p-4 border-brand-200 bg-brand-50/60 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <Calendar size={18} className="text-brand-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-900">Lease ending in {daysToLeaseEnd} days</p>
            <p className="text-xs text-brand-800/80 mt-0.5">Expires {formatDate(activeLease.endDate!)}</p>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 stagger">
        <StatTile
          label="Monthly rent"
          value={formatCurrency(activeLease.rentAmount)}
          icon={<CreditCard size={15} />}
          bg="bg-brand-50"
          fg="text-brand-700"
        />
        <StatTile
          label="Open issues"
          value={String(openMaintenance.length)}
          icon={<Wrench size={15} />}
          bg={openMaintenance.length > 0 ? 'bg-amber-50' : 'bg-surface-100'}
          fg={openMaintenance.length > 0 ? 'text-amber-700' : 'text-ink-400'}
        />
        <StatTile
          label="Invoices"
          value={String(invoices.length)}
          icon={<FileText size={15} />}
          bg="bg-brass-50"
          fg="text-brass-700"
        />
      </div>

      {/* Lease */}
      <div>
        <SectionTitle>Your lease</SectionTitle>
        <div className="card px-4">
          <InfoRow label="Lease start" value={formatDate(activeLease.startDate)} />
          <InfoRow label="Lease end" value={activeLease.endDate ? formatDate(activeLease.endDate) : 'Open-ended'} />
          <InfoRow label="Monthly rent" value={formatCurrency(activeLease.rentAmount)} />
          <InfoRow label="Deposit paid" value={formatCurrency(activeLease.depositPaid)} />
          <InfoRow label="Status" value="Active" />
        </div>
      </div>

      {/* Property */}
      <div>
        <SectionTitle>Property</SectionTitle>
        <div className="card px-4">
          <InfoRow label="Name" value={property.name} />
          {property.unitNumber && <InfoRow label="Unit" value={property.unitNumber} />}
          <InfoRow label="Address" value={property.address} />
          <InfoRow label="City" value={property.city} />
          <InfoRow label="Province" value={property.province} />
          {property.erfSize && <InfoRow label="Erf size" value={`${property.erfSize} m²`} />}
        </div>
      </div>
    </div>
  );
}

function WelcomeCard({ name, property }: { name: string; property: any }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div
      className="rounded-2xl p-6 text-white relative overflow-hidden shadow-md"
      style={{ background: 'linear-gradient(135deg, #094c40 0%, #03241f 100%)' }}
    >
      <div
        className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, white 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative">
        <p className="text-2xs font-bold text-brass-300 uppercase tracking-widest mb-2">
          {greeting}
        </p>
        <p className="font-display text-2xl mb-4 tracking-tight">{name.split(' ')[0]}</p>
        {property ? (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={14} className="text-white/70" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{property.name}</p>
              <p className="text-xs text-white/60 mt-0.5 truncate">
                {property.address}{property.unitNumber ? `, Unit ${property.unitNumber}` : ''}, {property.city}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/60">Welcome to PropMaster</p>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, icon, bg, fg }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <div className="card p-3.5 text-center">
      <div className={`w-8 h-8 rounded-xl ${bg} ${fg} flex items-center justify-center mx-auto mb-2`}>
        {icon}
      </div>
      <p className="text-base font-bold text-ink-900 leading-none tabular truncate" title={value}>
        {value}
      </p>
      <p className="text-2xs text-ink-400 mt-1.5 leading-tight font-medium">{label}</p>
    </div>
  );
}

function HomeLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="rounded-2xl" style={{ height: 140 }} />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <Skeleton key={i} className="rounded-2xl" style={{ height: 88 }} />)}
      </div>
      <Skeleton className="rounded-2xl" style={{ height: 220 }} />
      <Skeleton className="rounded-2xl" style={{ height: 220 }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ── Invoices Page ──────────────────────────────────────────
// ────────────────────────────────────────────────────────────
function InvoiceRow({ inv, payments }: { inv: Invoice; payments: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const linkedPayments = payments.filter(p => p.invoiceId === inv.id);
  const totalPaid = linkedPayments.reduce((s, p) => s + p.amount, 0);
  const balance = inv.totalAmount - totalPaid;
  const isUnpaid = inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'partial';

  const statusConfig = {
    paid:    { icon: CheckCircle,  bg: 'bg-brand-50',  iconColor: 'text-brand-700' },
    partial: { icon: Clock,        bg: 'bg-amber-50',  iconColor: 'text-amber-700' },
    overdue: { icon: AlertCircle,  bg: 'bg-red-50',    iconColor: 'text-red-600'  },
    sent:    { icon: Clock,        bg: 'bg-amber-50',  iconColor: 'text-amber-700' },
    draft:   { icon: FileText,     bg: 'bg-surface-100', iconColor: 'text-ink-400' },
  };
  const cfg = statusConfig[inv.status as keyof typeof statusConfig] || statusConfig.sent;
  const Icon = cfg.icon;

  return (
    <div className="border-b border-surface-100 last:border-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-surface-50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={17} className={cfg.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink-900">{inv.invoiceNumber}</p>
          <p className="text-xs text-ink-500 mt-0.5">
            {formatMonthYear(inv.month, inv.year)} · Due {formatDate(inv.dueDate)}
          </p>
          {inv.status === 'partial' && balance > 0 && (
            <p className="text-xs text-amber-700 font-semibold mt-0.5">
              {formatCurrency(balance)} outstanding
            </p>
          )}
          {inv.status === 'overdue' && (
            <p className="text-xs text-red-600 font-semibold mt-0.5">
              {balance > 0 ? `${formatCurrency(balance)} outstanding` : 'Payment required'}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end">
          <p className="text-sm font-bold text-ink-900 tabular">{formatCurrency(inv.totalAmount)}</p>
          {expanded
            ? <ChevronUp size={14} className="text-ink-400 mt-1" />
            : <ChevronDown size={14} className="text-ink-400 mt-1" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-surface-50 border-t border-surface-100 page-enter">
          <p className="text-2xs font-bold text-ink-500 uppercase tracking-widest mt-3 mb-2">Line items</p>
          <div className="space-y-1.5">
            {inv.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between text-xs text-ink-700">
                <span>{li.description}</span>
                <span className="font-semibold tabular">{formatCurrency(li.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold text-ink-900 pt-2 mt-2 border-t border-surface-200">
              <span>Total</span>
              <span className="tabular">{formatCurrency(inv.totalAmount)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between text-xs text-brand-700 font-semibold pt-1">
                  <span>Paid</span>
                  <span className="tabular">−{formatCurrency(totalPaid)}</span>
                </div>
                {balance > 0 && (
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span className={inv.status === 'overdue' ? 'text-red-700' : 'text-amber-800'}>
                      Outstanding
                    </span>
                    <span className={inv.status === 'overdue' ? 'text-red-700 tabular' : 'text-amber-800 tabular'}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          {isUnpaid && balance > 0 && (
            <div className="mt-3 p-3 bg-brand-50 rounded-xl border border-brand-100 text-xs">
              <p className="font-bold text-brand-800 mb-0.5">How to pay</p>
              <p className="text-brand-700 leading-relaxed">
                Pay via EFT into the bank account provided by your landlord, then notify them with the reference{' '}
                <span className="font-mono font-semibold">{inv.invoiceNumber}</span>.
                Online card payments coming soon.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TenantInvoicesPage() {
  const { invoices, payments, dataLoading, initialized, loadError, refreshData } = useTenant();
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  if (dataLoading && !initialized) return <ListLoading />;
  if (loadError) return <ErrorState message={loadError} onRetry={refreshData} />;

  const filtered = filter === 'all' ? invoices
    : filter === 'unpaid' ? invoices.filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'partial')
    : invoices.filter(i => i.status === 'paid');

  const outstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'partial')
    .reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title-display">Invoices</h1>
        {outstanding > 0 ? (
          <p className="text-sm text-amber-700 font-semibold mt-1 tabular">
            {formatCurrency(outstanding)} outstanding
          </p>
        ) : (
          <p className="text-sm text-ink-500 mt-1">All caught up</p>
        )}
      </div>

      <div className="flex gap-2" role="tablist">
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
              filter === f
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-surface-200 text-ink-600 hover:border-brand-300'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unpaid' ? 'Outstanding' : 'Paid'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={22} className="text-ink-400" />}
            title={filter === 'unpaid' ? 'All paid up' : 'No invoices'}
            description={filter === 'unpaid' ? 'You have no outstanding invoices.' : 'No invoices found.'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map(inv => <InvoiceRow key={inv.id} inv={inv} payments={payments} />)}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ── Payments Page ──────────────────────────────────────────
// ────────────────────────────────────────────────────────────
export function TenantPaymentsPage() {
  const { payments, invoices, dataLoading, initialized, loadError, refreshData } = useTenant();

  if (dataLoading && !initialized) return <ListLoading />;
  if (loadError) return <ErrorState message={loadError} onRetry={refreshData} />;

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title-display">Payment history</h1>
        {payments.length > 0 ? (
          <p className="text-sm text-ink-500 mt-1">
            <span className="font-bold text-ink-900 tabular">{formatCurrency(total)}</span> paid to date
          </p>
        ) : (
          <p className="text-sm text-ink-500 mt-1">No payments yet</p>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CreditCard size={22} className="text-ink-400" />}
            title="No payments yet"
            description="Your payment history will appear here once your landlord records a payment."
          />
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-surface-100">
          {payments.map(pay => {
            const linkedInv = pay.invoiceId ? invoices.find(i => i.id === pay.invoiceId) : null;
            return (
              <div key={pay.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={16} className="text-brand-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{formatDate(pay.paymentDate)}</p>
                  <p className="text-xs text-ink-500 mt-0.5 truncate">
                    {pay.method?.replace('_', ' ').toUpperCase()}
                    {linkedInv && (
                      <span className="text-brand-700 font-medium ml-1.5">
                        · {linkedInv.invoiceNumber}
                      </span>
                    )}
                    {pay.notes && <span className="ml-1 text-ink-400">· {pay.notes}</span>}
                  </p>
                </div>
                <p className="text-sm font-bold text-ink-900 tabular flex-shrink-0">
                  {formatCurrency(pay.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ── Maintenance Page ───────────────────────────────────────
// ────────────────────────────────────────────────────────────
function NewRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { submitMaintenanceRequest, showToast } = useTenant();
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Please describe the issue briefly';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await submitMaintenanceRequest(form);
      showToast('Maintenance request submitted');
      onClose();
      setForm({ title: '', description: '', priority: 'medium' });
    } catch (err: any) {
      showToast(err.message || 'Failed to submit — please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log maintenance request" size="md">
      <div className="p-6 space-y-4">
        <Field label="What's the issue?" required error={errors.title}>
          <input
            className="input"
            placeholder="e.g. Geyser not heating water"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            autoFocus
          />
        </Field>
        <Field label="More details">
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Describe the problem, when it started, how urgent it is…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </Field>
        <Field label="Priority">
          <Select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            options={[
              { value: 'low',    label: 'Low — not urgent' },
              { value: 'medium', label: 'Medium — needs attention soon' },
              { value: 'high',   label: 'High — affecting daily use' },
              { value: 'urgent', label: 'Urgent — health or safety risk' },
            ]}
          />
        </Field>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 gap-2">
            {saving ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</>
            ) : (
              <><Wrench size={14} /> Submit request</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TenantMaintenancePage() {
  const { maintenanceRequests, dataLoading, initialized, loadError, refreshData, activeLease } = useTenant();
  const [showNew, setShowNew] = useState(false);

  if (dataLoading && !initialized) return <ListLoading />;
  if (loadError) return <ErrorState message={loadError} onRetry={refreshData} />;

  const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
    open:        { label: 'Open',        color: 'text-ink-600',    bg: 'bg-surface-100 ring-surface-200' },
    in_progress: { label: 'In progress', color: 'text-amber-700',  bg: 'bg-amber-50 ring-amber-100' },
    resolved:    { label: 'Resolved',    color: 'text-brand-700',  bg: 'bg-brand-50 ring-brand-100' },
    closed:      { label: 'Closed',      color: 'text-ink-400',    bg: 'bg-surface-100 ring-surface-200' },
    completed:   { label: 'Completed',   color: 'text-brand-700',  bg: 'bg-brand-50 ring-brand-100' },
    cancelled:   { label: 'Cancelled',   color: 'text-ink-400',    bg: 'bg-surface-100 ring-surface-200' },
  };
  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-brand-400', low: 'bg-ink-300',
  };

  const canSubmit = !!activeLease;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title-display">Maintenance</h1>
          <p className="text-sm text-ink-500 mt-1">
            {maintenanceRequests.length} {maintenanceRequests.length === 1 ? 'request' : 'requests'}
          </p>
        </div>
        {canSubmit && (
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs px-3 py-2 gap-1.5">
            <Plus size={14} /> Log issue
          </button>
        )}
      </div>

      {!canSubmit ? (
        <div className="card">
          <EmptyState
            icon={<Wrench size={22} className="text-ink-400" />}
            title="No active lease"
            description="You need an active lease to log maintenance requests. Please contact your landlord."
          />
        </div>
      ) : maintenanceRequests.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Sparkles size={22} className="text-brand-600" />}
            title="No issues — nice!"
            description="When something needs attention, log it here and your landlord will get notified."
            action={
              <button onClick={() => setShowNew(true)} className="btn-primary">
                <Plus size={14} /> Log an issue
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-surface-100">
          {maintenanceRequests.map(req => {
            const s = statusMeta[req.status] || statusMeta.open;
            return (
              <div key={req.id} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${priorityDot[req.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-ink-900">{req.title}</p>
                      <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ring-1 ring-inset ${s.bg} ${s.color}`}>
                        {s.label}
                      </span>
                    </div>
                    {req.description && (
                      <p className="text-xs text-ink-500 leading-relaxed mb-1.5">{req.description}</p>
                    )}
                    {req.resolutionNote && (
                      <div className="mt-2 px-3 py-2 bg-brand-50 rounded-lg border border-brand-100">
                        <p className="text-2xs font-bold text-brand-800 uppercase tracking-wide mb-0.5">
                          Resolved by landlord
                        </p>
                        <p className="text-xs text-brand-900 leading-relaxed">{req.resolutionNote}</p>
                      </div>
                    )}
                    <p className="text-2xs text-ink-400 mt-2 font-medium">
                      Logged {formatDate(req.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewRequestModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}

// ── Shared loading + error states for sub-pages ────────────
function ListLoading() {
  return (
    <div className="space-y-4">
      <Skeleton style={{ height: 60 }} className="rounded-xl" />
      <div className="card overflow-hidden">
        {[1,2,3,4].map(i => (
          <div key={i} className="px-4 py-4 border-b border-surface-100 last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-32 mb-2" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StateCard
      icon={<AlertCircle size={24} className="text-red-500" />}
      title="Couldn't load"
      message={message}
      action={
        <button onClick={onRetry} className="btn-secondary">
          <RotateCcw size={14} /> Try again
        </button>
      }
    />
  );
}

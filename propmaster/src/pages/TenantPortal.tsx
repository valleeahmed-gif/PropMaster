import React, { useState } from 'react';
import { Building2, FileText, CreditCard, Wrench, LogOut, Plus, Home } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal, EmptyState, StatusBadge, Field, Select } from '../components/UI';
import { ToastContainer } from '../components/UI';
import { LogoIcon } from '../components/Logo';
import { formatCurrency, formatDate, formatMonthYear } from '../utils';
import { supabase } from '../lib/supabase';

// ── Bottom Nav for tenant portal ────────────────────────────
function TenantNav({ tab, onChange }: { tab: string; onChange: (t: string) => void }) {
  const items = [
    { id: 'home', icon: <Home size={20} />, label: 'Home' },
    { id: 'invoices', icon: <FileText size={20} />, label: 'Invoices' },
    { id: 'payments', icon: <CreditCard size={20} />, label: 'Payments' },
    { id: 'maintenance', icon: <Wrench size={20} />, label: 'Maintenance' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-surface-200 flex safe-area-bottom">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            tab === item.id ? 'text-brand-600' : 'text-gray-400'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}

// ── Tenant Home Tab ─────────────────────────────────────────
function TenantHomeTab() {
  const { user, leases, properties, tenants, payments } = useApp();

  const myTenant = tenants.find(t => t.userId === user?.id || t.email === user?.email);
  const myLease = myTenant ? leases.find(l => l.tenantId === myTenant.id && l.status === 'active') : null;
  const myProperty = myLease ? properties.find(p => p.id === myLease.propertyId) : null;
  const myPayments = payments.filter(p => myLease ? p.leaseId === myLease.id : false);
  const totalPaid = myPayments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-base font-bold text-brand-700">
              {user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'T'}
            </span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Welcome, {user?.name?.split(' ')[0] || 'Tenant'}</h2>
            <p className="text-xs text-gray-500">Tenant portal</p>
          </div>
        </div>
      </div>

      {/* Current lease */}
      {myLease && myProperty ? (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-900">Your rental</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Property</p>
              <p className="font-medium text-gray-900">{myProperty.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {myProperty.address}{myProperty.unitNumber ? `, Unit ${myProperty.unitNumber}` : ''}, {myProperty.city}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-100">
              <div>
                <p className="text-xs text-gray-500">Monthly rent</p>
                <p className="font-semibold text-gray-900">{formatCurrency(myLease.rentAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Deposit paid</p>
                <p className="font-semibold text-gray-900">{formatCurrency(myLease.depositPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Lease start</p>
                <p className="font-medium">{formatDate(myLease.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Lease end</p>
                <p className="font-medium">{myLease.endDate ? formatDate(myLease.endDate) : 'Open-ended'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Building2 size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No active lease found.</p>
          <p className="text-xs text-gray-400 mt-1">Contact your landlord if this seems wrong.</p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total paid</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Payments</p>
          <p className="text-lg font-bold text-gray-900">{myPayments.length}</p>
        </div>
      </div>
    </div>
  );
}

// ── Tenant Invoices Tab ─────────────────────────────────────
function TenantInvoicesTab() {
  const { user, invoices, leases, tenants } = useApp();

  const myTenant = tenants.find(t => t.userId === user?.id || t.email === user?.email);
  const myLeaseIds = myTenant
    ? leases.filter(l => l.tenantId === myTenant.id).map(l => l.id)
    : [];
  const myInvoices = [...invoices.filter(i => myLeaseIds.includes(i.leaseId))]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (myInvoices.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<FileText size={22} />}
          title="No invoices yet"
          description="Your invoices from your landlord will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {myInvoices.map(inv => (
        <div key={inv.id} className="card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{inv.invoiceNumber}</span>
                <StatusBadge status={inv.status} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatMonthYear(inv.month, inv.year)} · Due {formatDate(inv.dueDate)}
              </p>
            </div>
            <p className="text-base font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
          </div>

          {/* Line items */}
          <div className="space-y-1 pb-3 border-b border-surface-100">
            {inv.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span>{li.description}</span>
                <span className="font-medium">{formatCurrency(li.amount)}</span>
              </div>
            ))}
          </div>

          {(inv.status === 'sent' || inv.status === 'overdue') && (
            <div className="pt-3">
              <p className="text-xs text-gray-500 mb-2">
                {inv.status === 'overdue' ? '⚠ This invoice is overdue.' : 'Payment is due.'}
              </p>
              <p className="text-xs text-gray-400">Please pay via EFT and contact your landlord to confirm.</p>
            </div>
          )}

          {inv.status === 'paid' && (
            <p className="text-xs text-green-600 font-medium mt-3">✓ Paid</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tenant Payments Tab ─────────────────────────────────────
function TenantPaymentsTab() {
  const { user, payments, leases, tenants } = useApp();

  const myTenant = tenants.find(t => t.userId === user?.id || t.email === user?.email);
  const myLeaseIds = myTenant
    ? leases.filter(l => l.tenantId === myTenant.id).map(l => l.id)
    : [];
  const myPayments = [...payments.filter(p => myLeaseIds.includes(p.leaseId ?? ''))]
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  if (myPayments.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<CreditCard size={22} />}
          title="No payments yet"
          description="Your payment history will appear here once payments are recorded."
        />
      </div>
    );
  }

  return (
    <div className="card divide-y divide-surface-100">
      {myPayments.map(pay => (
        <div key={pay.id} className="flex items-center gap-3 px-4 py-4">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <CreditCard size={16} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{formatDate(pay.paymentDate)}</p>
            <p className="text-xs text-gray-500">{pay.method.replace('_', ' ').toUpperCase()}</p>
            {pay.notes && <p className="text-xs text-gray-400">{pay.notes}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold text-gray-900">{formatCurrency(pay.amount)}</p>
            <StatusBadge status={pay.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tenant Maintenance Tab ──────────────────────────────────
function TenantMaintenanceTab() {
  const { user, maintenanceRequests, leases, tenants, addMaintenanceRequest, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  const myTenant = tenants.find(t => t.userId === user?.id || t.email === user?.email);
  const myLease = myTenant ? leases.find(l => l.tenantId === myTenant.id && l.status === 'active') : null;
  const myRequests = [...maintenanceRequests.filter(m => m.tenantId === myTenant?.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleAdd = async () => {
    if (!form.title.trim() || !myLease) return;
    setSaving(true);
    try {
      await addMaintenanceRequest({
        propertyId: myLease.propertyId,
        leaseId: myLease.id,
        tenantId: myTenant?.id,
        title: form.title.trim(),
        description: form.description,
        status: 'open',
        priority: form.priority as any,
      });
      showToast('Maintenance request submitted');
      setShowAdd(false);
      setForm({ title: '', description: '', priority: 'medium' });
    } catch {
      showToast('Failed to submit request', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    open: 'text-gray-600',
    in_progress: 'text-amber-700',
    resolved: 'text-green-700',
    closed: 'text-gray-400',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Maintenance ({myRequests.length})</h3>
        {myLease && (
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2">
            <Plus size={14} /> Log request
          </button>
        )}
      </div>

      {myRequests.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Wrench size={22} />}
            title="No maintenance requests"
            description="Log a maintenance issue and your landlord will be notified."
            action={myLease ? <button onClick={() => setShowAdd(true)} className="btn-primary">Log request</button> : undefined}
          />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {myRequests.map(req => (
            <div key={req.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{req.title}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusBadge status={req.status} />
                </div>
              </div>
              {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
              <p className="text-xs text-gray-400 mt-2">{formatDate(req.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Log maintenance request">
        <div className="p-6 space-y-4">
          <Field label="Title" required>
            <input className="input" placeholder="e.g. Geyser not heating" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className="input resize-none" rows={4} placeholder="Please describe the issue in detail…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent — needs immediate attention' },
            ]} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.title.trim()} className="btn-primary flex-1 justify-center">
              {saving ? (
                <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</span>
              ) : 'Submit request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Main Tenant Portal ──────────────────────────────────────
export function TenantPortalPage() {
  const { user, logout } = useApp();
  const [tab, setTab] = useState('home');

  const titles: Record<string, string> = {
    home: 'My Home',
    invoices: 'My Invoices',
    payments: 'Payment History',
    maintenance: 'Maintenance',
  };

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      {/* Header */}
      <div className="bg-brand-700 text-white sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={28} />
            <span className="font-semibold text-base">{titles[tab]}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5">
        {tab === 'home' && <TenantHomeTab />}
        {tab === 'invoices' && <TenantInvoicesTab />}
        {tab === 'payments' && <TenantPaymentsTab />}
        {tab === 'maintenance' && <TenantMaintenanceTab />}
      </div>

      <TenantNav tab={tab} onChange={setTab} />
      <ToastContainer />
    </div>
  );
}

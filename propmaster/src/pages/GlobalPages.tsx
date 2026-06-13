import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Mail, Phone, Building2, Search, Filter, FileText, CreditCard, Wrench, ChevronRight, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal, EmptyState, PageHeader, StatusBadge, PriorityBadge, Field, Select } from '../components/UI';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { formatCurrency, formatDate, formatMonthYear } from '../utils';

// ── Tenants Page ───────────────────────────────────────────
export function TenantsPage() {
  const navigate = useNavigate();
  const { tenants, leases, properties, inviteTenant, showToast, user } = useApp();
  const [search, setSearch] = useState('');

  const myTenants = tenants.filter(t => t.ownerId === user?.id);
  const filtered = myTenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  const getTenantLease = (tenantId: string) =>
    leases.find(l => l.tenantId === tenantId && l.status === 'active');

  const getTenantProperty = (tenantId: string) => {
    const lease = getTenantLease(tenantId);
    return lease ? properties.find(p => p.id === lease.propertyId) : null;
  };

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle={`${myTenants.length} ${myTenants.length === 1 ? 'tenant' : 'tenants'}`}
        action={
          <button onClick={() => navigate('/properties')} className="btn-primary">
            <Plus size={16} /> Add via property
          </button>
        }
      />

      {/* Search */}
      {myTenants.length > 0 && (
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search tenants…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {myTenants.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={24} />}
            title="No tenants yet"
            description="Tenants are added when you create a lease for a property."
            action={<button onClick={() => navigate('/properties')} className="btn-primary">Go to properties</button>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No tenants matching "{search}"</div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {filtered.map(tenant => {
            const lease = getTenantLease(tenant.id);
            const property = getTenantProperty(tenant.id);
            return (
              <div key={tenant.id} className="flex items-center gap-4 px-4 py-4">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-brand-700">
                    {tenant.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{tenant.name}</p>
                    <StatusBadge status={tenant.inviteStatus} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Mail size={10} />{tenant.email}</span>
                    {tenant.phone && <span className="flex items-center gap-1"><Phone size={10} />{tenant.phone}</span>}
                  </div>
                  {property && (
                    <button
                      onClick={() => navigate(`/properties/${property.id}`)}
                      className="flex items-center gap-1 text-xs text-brand-600 mt-1 hover:underline"
                    >
                      <Building2 size={10} />{property.name}
                    </button>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {lease && <p className="text-sm font-semibold text-gray-900">{formatCurrency(lease.rentAmount)}/mo</p>}
                  {tenant.inviteStatus === 'none' && (
                    <button
                      onClick={() => { inviteTenant(tenant.id); showToast(`Invite sent to ${tenant.email}`); }}
                      className="btn-secondary text-xs px-2.5 py-1.5 gap-1"
                    >
                      <Mail size={12} /> Send invite
                    </button>
                  )}
                  {tenant.inviteStatus === 'pending' && (
                    <span className="text-xs text-amber-600 font-medium">Invite pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Invoices Page ──────────────────────────────────────────
export function InvoicesPage() {
  const navigate = useNavigate();
  const { invoices, properties, updateInvoice, showToast, user } = useApp();
  const [filter, setFilter] = useState<string>('all');
  const [payingInvoice, setPayingInvoice] = useState<any>(null);

  const myInvoices = [...invoices.filter(i => i.ownerId === user?.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = filter === 'all' ? myInvoices : myInvoices.filter(i => i.status === filter);

  const filters = [
    { id: 'all', label: 'All', count: myInvoices.length },
    { id: 'draft', label: 'Draft', count: myInvoices.filter(i => i.status === 'draft').length },
    { id: 'sent', label: 'Sent', count: myInvoices.filter(i => i.status === 'sent').length },
    { id: 'overdue', label: 'Overdue', count: myInvoices.filter(i => i.status === 'overdue').length },
    { id: 'paid', label: 'Paid', count: myInvoices.filter(i => i.status === 'paid').length },
  ];

  const handleMarkSent = async (inv: any) => {
    await updateInvoice(inv.id, { status: 'sent' });
    showToast(`${inv.invoiceNumber} marked as sent`);
  };

  return (
    <div>
      <PageHeader title="Invoices" subtitle={`${myInvoices.length} total`} />

      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-surface-200 text-gray-600 hover:border-brand-300'
            }`}
          >
            {f.label}
            <span className={`text-xs ${filter === f.id ? 'opacity-70' : 'text-gray-400'}`}>({f.count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText size={22} />} title="No invoices" description="Invoices are created from the property detail page." action={<button onClick={() => navigate('/properties')} className="btn-primary">Go to properties</button>} />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {filtered.map(inv => {
            const prop = properties.find(p => p.id === inv.propertyId);
            const actionable = inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'draft';
            return (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-4">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/properties/${inv.propertyId}`)}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{prop?.name} · {formatMonthYear(inv.month, inv.year)}</p>
                  <p className="text-xs text-gray-400">Due {formatDate(inv.dueDate)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <p className="text-base font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                  {inv.status === 'draft' && (
                    <button onClick={() => handleMarkSent(inv)} className="btn-secondary text-xs px-2 py-1 gap-1">
                      <Send size={11} /> Send
                    </button>
                  )}
                  {actionable && (
                    <button onClick={() => setPayingInvoice(inv)} className="btn-primary text-xs px-2 py-1 gap-1">
                      <CreditCard size={11} /> Pay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecordPaymentModal
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
        invoice={payingInvoice ?? undefined}
      />
    </div>
  );
}

// ── Payments Page ──────────────────────────────────────────
export function PaymentsPage() {
  const { payments, properties, user } = useApp();

  const myPayments = [...payments.filter(p => p.ownerId === user?.id)].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const totalVerified = myPayments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader title="Payments" subtitle={`${myPayments.length} payments · ${formatCurrency(totalVerified)} total`} />

      {myPayments.length === 0 ? (
        <div className="card">
          <EmptyState icon={<CreditCard size={22} />} title="No payments recorded" description="Record payments from the property detail page." />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {myPayments.map(pay => {
            const prop = properties.find(p => p.id === pay.propertyId);
            return (
              <div key={pay.id} className="flex items-center gap-4 px-4 py-4">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={16} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{prop?.name}</p>
                  <p className="text-xs text-gray-500">{formatDate(pay.paymentDate)} · {pay.method.toUpperCase()}</p>
                  {pay.notes && <p className="text-xs text-gray-400 mt-0.5">{pay.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-gray-900">{formatCurrency(pay.amount)}</p>
                  <StatusBadge status={pay.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Maintenance Page ───────────────────────────────────────
export function MaintenancePage() {
  const navigate = useNavigate();
  const { maintenanceRequests, properties, updateMaintenanceRequest, showToast, user } = useApp();
  const [filter, setFilter] = useState<string>('all');

  const myRequests = [...maintenanceRequests.filter(m => m.ownerId === user?.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = filter === 'all' ? myRequests : myRequests.filter(m => m.status === filter);

  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-400', low: 'bg-gray-300',
  };

  return (
    <div>
      <PageHeader title="Maintenance" subtitle={`${myRequests.filter(m => m.status === 'open' || m.status === 'in_progress').length} open`} />

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              filter === f ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-surface-200 text-gray-600 hover:border-brand-300'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Wrench size={22} />} title="No maintenance requests" description="Maintenance requests are logged from the property detail page." />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {filtered.map(req => {
            const prop = properties.find(p => p.id === req.propertyId);
            return (
              <div key={req.id} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[req.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{req.title}</p>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <PriorityBadge priority={req.priority} />
                        <StatusBadge status={req.status} />
                      </div>
                    </div>
                    {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
                    <button
                      onClick={() => navigate(`/properties/${req.propertyId}`)}
                      className="text-xs text-brand-600 hover:underline mt-1 flex items-center gap-1"
                    >
                      <Building2 size={10} />{prop?.name}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(req.createdAt)}</p>
                    {/* Quick actions */}
                    {req.status === 'open' && (
                      <button onClick={() => { updateMaintenanceRequest(req.id, { status: 'in_progress' }); showToast('Marked in progress'); }} className="btn-secondary text-xs px-2.5 py-1.5 mt-2">Mark in progress</button>
                    )}
                    {req.status === 'in_progress' && (
                      <button onClick={() => { updateMaintenanceRequest(req.id, { status: 'resolved' }); showToast('Marked as resolved'); }} className="btn-secondary text-xs px-2.5 py-1.5 mt-2">Mark resolved</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

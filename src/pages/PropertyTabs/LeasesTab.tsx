import React, { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal, ConfirmDialog, EmptyState, StatusBadge, Field, Select } from '../../components/UI';
import { Tenant, Lease } from '../../types';
import { formatCurrency, formatDate, generateId, today } from '../../utils';

interface Props { propertyId: string; }

function NewTenantLeaseModal({ open, onClose, propertyId }: { open: boolean; onClose: () => void; propertyId: string }) {
  const { addTenant, addLease, tenants, leases, showToast, user } = useApp();
  const [step, setStep] = useState<'tenant' | 'lease'>('tenant');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantForm, setTenantForm] = useState({ name: '', email: '', phone: '' });
  const [leaseForm, setLeaseForm] = useState({ startDate: today(), endDate: '', rentAmount: '', depositPaid: '' });
  const [createdTenantId, setCreatedTenantId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableTenants = tenants.filter(t => t.ownerId === user?.id);
  // Tenants without an active lease on this property
  const existingLeases = leases.filter(l => l.status === 'active');
  const tenantsWithoutLease = availableTenants.filter(t =>
    !existingLeases.find(l => l.tenantId === t.id && l.propertyId === propertyId)
  );

  const validateTenant = () => {
    const e: Record<string, string> = {};
    if (mode === 'new') {
      if (!tenantForm.name.trim()) e.name = 'Name required';
      if (!tenantForm.email.trim()) e.email = 'Email required';
    } else {
      if (!selectedTenantId) e.tenant = 'Select a tenant';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateLease = () => {
    const e: Record<string, string> = {};
    if (!leaseForm.startDate) e.startDate = 'Start date required';
    if (!leaseForm.rentAmount || Number(leaseForm.rentAmount) <= 0) e.rentAmount = 'Valid rent amount required';
    if (!leaseForm.depositPaid || Number(leaseForm.depositPaid) < 0) e.depositPaid = 'Deposit amount required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validateTenant()) return;
    if (mode === 'new') {
      const t = await addTenant(tenantForm);
      setCreatedTenantId(t.id);
    } else {
      setCreatedTenantId(selectedTenantId);
    }
    setStep('lease');
  };

  const handleSave = async () => {
    if (!validateLease()) return;
    await addLease({
      propertyId,
      tenantId: createdTenantId,
      startDate: leaseForm.startDate,
      endDate: leaseForm.endDate || undefined,
      rentAmount: Number(leaseForm.rentAmount),
      depositPaid: Number(leaseForm.depositPaid),
      status: 'active',
    });
    showToast('Tenant and lease created');
    onClose();
    setStep('tenant');
    setTenantForm({ name: '', email: '', phone: '' });
    setLeaseForm({ startDate: today(), endDate: '', rentAmount: '', depositPaid: '' });
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 'tenant' ? 'Add tenant' : 'Lease details'}>
      <div className="p-6 space-y-4">
        {step === 'tenant' && (
          <>
            <div className="flex gap-2 p-1 bg-surface-100 rounded-xl mb-4">
              {(['new', 'existing'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                  {m === 'new' ? 'New tenant' : 'Existing tenant'}
                </button>
              ))}
            </div>
            {mode === 'new' ? (
              <>
                <Field label="Full name" required error={errors.name}>
                  <input className="input" value={tenantForm.name} onChange={e => setTenantForm(f => ({ ...f, name: e.target.value }))} placeholder="Sarah Nkosi" />
                </Field>
                <Field label="Email address" required error={errors.email}>
                  <input className="input" type="email" value={tenantForm.email} onChange={e => setTenantForm(f => ({ ...f, email: e.target.value }))} placeholder="tenant@email.com" />
                </Field>
                <Field label="Phone number">
                  <input className="input" value={tenantForm.phone} onChange={e => setTenantForm(f => ({ ...f, phone: e.target.value }))} placeholder="071 234 5678" />
                </Field>
              </>
            ) : (
              <Field label="Select tenant" required error={errors.tenant}>
                <Select
                  value={selectedTenantId}
                  onChange={e => setSelectedTenantId(e.target.value)}
                  options={tenantsWithoutLease.map(t => ({ value: t.id, label: `${t.name} (${t.email})` }))}
                  placeholder="Choose a tenant…"
                />
              </Field>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleNext} className="btn-primary flex-1 justify-center">Next: Lease details →</button>
            </div>
          </>
        )}
        {step === 'lease' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lease start date" required error={errors.startDate}>
                <input className="input" type="date" value={leaseForm.startDate} onChange={e => setLeaseForm(f => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label="Lease end date">
                <input className="input" type="date" value={leaseForm.endDate} onChange={e => setLeaseForm(f => ({ ...f, endDate: e.target.value }))} />
              </Field>
            </div>
            <Field label="Monthly rent (ZAR)" required error={errors.rentAmount}>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                <input className="input pl-7" type="number" inputMode="decimal" value={leaseForm.rentAmount} onChange={e => setLeaseForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="12 500" />
              </div>
            </Field>
            <Field label="Deposit paid (ZAR)" required error={errors.depositPaid} hint="Typically 1–2 months' rent">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                <input className="input pl-7" type="number" inputMode="decimal" value={leaseForm.depositPaid} onChange={e => setLeaseForm(f => ({ ...f, depositPaid: e.target.value }))} placeholder="25 000" />
              </div>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('tenant')} className="btn-secondary flex-1 justify-center">← Back</button>
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">Create lease</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function LeasesTab({ propertyId }: Props) {
  const { leases, tenants, endLease, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [endingLease, setEndingLease] = useState<string | null>(null);

  const propertyLeases = leases.filter(l => l.propertyId === propertyId);
  const activeLease = propertyLeases.find(l => l.status === 'active');
  const pastLeases = propertyLeases.filter(l => l.status !== 'active');

  return (
    <div className="space-y-5">
      {/* Active lease */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Active lease</h3>
          {!activeLease && (
            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2">
              <Plus size={14} /> Add tenant
            </button>
          )}
        </div>

        {activeLease ? (() => {
          const tenant = tenants.find(t => t.id === activeLease.tenantId);
          return (
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-brand-700">
                      {tenant?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{tenant?.name}</p>
                    <p className="text-xs text-gray-500">{tenant?.email} · {tenant?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={activeLease.status} />
                  <button onClick={() => setEndingLease(activeLease.id)} className="btn-danger text-xs px-3 py-1.5">End lease</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-surface-100 text-sm">
                <div><p className="text-xs text-gray-500">Start date</p><p className="font-medium">{formatDate(activeLease.startDate)}</p></div>
                <div><p className="text-xs text-gray-500">End date</p><p className="font-medium">{activeLease.endDate ? formatDate(activeLease.endDate) : 'Open-ended'}</p></div>
                <div><p className="text-xs text-gray-500">Monthly rent</p><p className="font-medium">{formatCurrency(activeLease.rentAmount)}</p></div>
                <div><p className="text-xs text-gray-500">Deposit paid</p><p className="font-medium">{formatCurrency(activeLease.depositPaid)}</p></div>
              </div>
            </div>
          );
        })() : (
          <div className="card p-8 text-center border-dashed border-2">
            <UserPlus size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">No active lease on this property</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">Add tenant &amp; lease</button>
          </div>
        )}
      </div>

      {/* Lease history */}
      {pastLeases.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Lease history</h3>
          <div className="card divide-y divide-surface-100">
            {pastLeases.map(l => {
              const t = tenants.find(ten => ten.id === l.tenantId);
              return (
                <div key={l.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{t?.name || 'Unknown tenant'}</p>
                    <p className="text-xs text-gray-500">{formatDate(l.startDate)} → {l.endDate ? formatDate(l.endDate) : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{formatCurrency(l.rentAmount)}/mo</p>
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NewTenantLeaseModal open={showAdd} onClose={() => setShowAdd(false)} propertyId={propertyId} />
      <ConfirmDialog
        open={!!endingLease}
        onClose={() => setEndingLease(null)}
        onConfirm={() => { endLease(endingLease!); showToast('Lease ended'); setEndingLease(null); }}
        title="End lease"
        message="This will mark the current lease as ended. The tenant will no longer have access to the tenant portal for this property."
        confirmLabel="End lease"
        danger
      />
    </div>
  );
}

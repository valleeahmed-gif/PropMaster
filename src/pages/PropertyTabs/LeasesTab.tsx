import React, { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal, ConfirmDialog, EmptyState, StatusBadge, Field, Select } from '../../components/UI';
import { CustomerType, LeaseType, RentFrequency } from '../../types';
import {
  formatCurrency, formatDate, today,
  CUSTOMER_TYPES, LEASE_TYPES, RENT_FREQUENCIES, DUE_DAYS,
  computeLeaseEndDate, labelFor,
} from '../../utils';

interface Props { propertyId: string; }

const EMPTY_TENANT_FORM = {
  customerType: 'individual' as CustomerType,
  firstName: '', lastName: '', idNumber: '', countryIssuing: '',
  email: '', secondaryEmail: '', landline: '', phone: '',
  businessAddress: '', businessAddress2: '',
  bankName: '', bankAccountNumber: '', bankBranchCode: '',
};

const EMPTY_LEASE_FORM = {
  leaseType: 'fixed_term' as LeaseType,
  startDate: today(), durationMonths: '',
  rentFrequency: 'monthly' as RentFrequency, dueDay: '1',
  rentAmount: '', depositPaid: '',
};

function NewTenantLeaseModal({ open, onClose, propertyId }: { open: boolean; onClose: () => void; propertyId: string }) {
  const { addTenant, addLease, tenants, leases, showToast, user } = useApp();
  const [step, setStep] = useState<'tenant' | 'lease'>('tenant');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantForm, setTenantForm] = useState(EMPTY_TENANT_FORM);
  const [showSecondAddress, setShowSecondAddress] = useState(false);
  const [leaseForm, setLeaseForm] = useState(EMPTY_LEASE_FORM);
  const [createdTenantId, setCreatedTenantId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setT = (k: keyof typeof tenantForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setTenantForm(f => ({ ...f, [k]: e.target.value }));
  const setL = (k: keyof typeof leaseForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setLeaseForm(f => ({ ...f, [k]: e.target.value }));

  const isBusiness = tenantForm.customerType === 'business';
  const isFixedTerm = leaseForm.leaseType === 'fixed_term';
  // End date is auto-calculated from start + duration for fixed-term leases.
  const computedEndDate = isFixedTerm
    ? computeLeaseEndDate(leaseForm.startDate, Number(leaseForm.durationMonths))
    : '';

  const availableTenants = tenants.filter(t => t.ownerId === user?.id);
  const existingLeases = leases.filter(l => l.status === 'active');
  const tenantsWithoutLease = availableTenants.filter(t =>
    !existingLeases.find(l => l.tenantId === t.id && l.propertyId === propertyId)
  );

  const resetForms = () => {
    setStep('tenant');
    setMode('new');
    setSelectedTenantId('');
    setTenantForm(EMPTY_TENANT_FORM);
    setShowSecondAddress(false);
    setLeaseForm(EMPTY_LEASE_FORM);
    setCreatedTenantId('');
    setErrors({});
  };

  const handleClose = () => { onClose(); resetForms(); };

  const validateTenant = () => {
    const e: Record<string, string> = {};
    if (mode === 'new') {
      if (!tenantForm.firstName.trim()) e.firstName = isBusiness ? 'Contact first name required' : 'First name required';
      if (!tenantForm.lastName.trim()) e.lastName = isBusiness ? 'Contact last name required' : 'Last name required';
      if (!tenantForm.email.trim()) e.email = 'Email required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantForm.email)) e.email = 'Enter a valid email';
    } else {
      if (!selectedTenantId) e.tenant = 'Select a tenant';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateLease = () => {
    const e: Record<string, string> = {};
    if (!leaseForm.startDate) e.startDate = 'Start date required';
    if (isFixedTerm && (!leaseForm.durationMonths || Number(leaseForm.durationMonths) <= 0)) e.durationMonths = 'Duration required';
    if (!leaseForm.rentAmount || Number(leaseForm.rentAmount) <= 0) e.rentAmount = 'Valid rent amount required';
    if (!leaseForm.depositPaid || Number(leaseForm.depositPaid) < 0) e.depositPaid = 'Deposit amount required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validateTenant()) return;
    if (mode === 'new') {
      const displayName = `${tenantForm.firstName} ${tenantForm.lastName}`.trim() || tenantForm.email;
      const t = await addTenant({
        customerType: tenantForm.customerType,
        firstName: tenantForm.firstName.trim() || undefined,
        lastName: tenantForm.lastName.trim() || undefined,
        name: displayName,
        idNumber: tenantForm.idNumber.trim() || undefined,
        countryIssuing: tenantForm.countryIssuing.trim() || undefined,
        email: tenantForm.email.trim(),
        secondaryEmail: tenantForm.secondaryEmail.trim() || undefined,
        landline: tenantForm.landline.trim() || undefined,
        phone: tenantForm.phone.trim(),
        businessAddress: tenantForm.businessAddress.trim() || undefined,
        businessAddress2: tenantForm.businessAddress2.trim() || undefined,
        bankName: tenantForm.bankName.trim() || undefined,
        bankAccountNumber: tenantForm.bankAccountNumber.trim() || undefined,
        bankBranchCode: tenantForm.bankBranchCode.trim() || undefined,
      });
      setCreatedTenantId(t.id);
    } else {
      setCreatedTenantId(selectedTenantId);
    }
    setErrors({});
    setStep('lease');
  };

  const handleSave = async () => {
    if (!validateLease()) return;
    await addLease({
      propertyId,
      tenantId: createdTenantId,
      leaseType: leaseForm.leaseType,
      startDate: leaseForm.startDate,
      durationMonths: isFixedTerm && leaseForm.durationMonths ? Number(leaseForm.durationMonths) : undefined,
      endDate: computedEndDate || undefined,
      rentFrequency: leaseForm.rentFrequency,
      dueDay: leaseForm.dueDay ? Number(leaseForm.dueDay) : undefined,
      rentAmount: Number(leaseForm.rentAmount),
      depositPaid: Number(leaseForm.depositPaid),
      status: 'active',
    });
    showToast('Tenant and lease created');
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={step === 'tenant' ? 'Add tenant' : 'Lease details'}>
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
                <Field label="Customer type" required>
                  <Select value={tenantForm.customerType} onChange={setT('customerType')} options={CUSTOMER_TYPES} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={isBusiness ? 'Contact first name' : 'First names'} required error={errors.firstName}>
                    <input className="input" value={tenantForm.firstName} onChange={setT('firstName')} placeholder="Sarah" />
                  </Field>
                  <Field label={isBusiness ? 'Contact last name' : 'Last names'} required error={errors.lastName}>
                    <input className="input" value={tenantForm.lastName} onChange={setT('lastName')} placeholder="Nkosi" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID / Passport number">
                    <input className="input" value={tenantForm.idNumber} onChange={setT('idNumber')} placeholder="8001015009087" />
                  </Field>
                  <Field label="Country issuing">
                    <input className="input" value={tenantForm.countryIssuing} onChange={setT('countryIssuing')} placeholder="South Africa" />
                  </Field>
                </div>
                <Field label="Email address" required error={errors.email}>
                  <input className="input" type="email" value={tenantForm.email} onChange={setT('email')} placeholder="tenant@email.com" />
                </Field>
                <Field label="Secondary email address">
                  <input className="input" type="email" value={tenantForm.secondaryEmail} onChange={setT('secondaryEmail')} placeholder="alt@email.com" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Landline number">
                    <input className="input" value={tenantForm.landline} onChange={setT('landline')} placeholder="011 234 5678" />
                  </Field>
                  <Field label="Cell number">
                    <input className="input" value={tenantForm.phone} onChange={setT('phone')} placeholder="071 234 5678" />
                  </Field>
                </div>

                <Field label={isBusiness ? 'Business address' : 'Address'}>
                  <textarea className="input min-h-[64px] resize-y" value={tenantForm.businessAddress} onChange={e => setTenantForm(f => ({ ...f, businessAddress: e.target.value }))} placeholder="Street, suburb, city, postal code" />
                </Field>
                {showSecondAddress ? (
                  <Field label="Additional address">
                    <textarea className="input min-h-[64px] resize-y" value={tenantForm.businessAddress2} onChange={e => setTenantForm(f => ({ ...f, businessAddress2: e.target.value }))} placeholder="Second address" />
                  </Field>
                ) : (
                  <button type="button" onClick={() => setShowSecondAddress(true)} className="text-xs font-medium text-brand-600 hover:underline">
                    + Add another address
                  </button>
                )}

                {/* Bank account — structured */}
                <div className="rounded-xl border border-surface-200 p-3 space-y-3">
                  <p className="text-xs font-semibold text-ink-600">Bank account</p>
                  <Field label="Bank name">
                    <input className="input" value={tenantForm.bankName} onChange={setT('bankName')} placeholder="FNB" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Account number">
                      <input className="input" inputMode="numeric" value={tenantForm.bankAccountNumber} onChange={setT('bankAccountNumber')} placeholder="62012345678" />
                    </Field>
                    <Field label="Branch code">
                      <input className="input" inputMode="numeric" value={tenantForm.bankBranchCode} onChange={setT('bankBranchCode')} placeholder="250655" />
                    </Field>
                  </div>
                </div>
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
              <button onClick={handleClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleNext} className="btn-primary flex-1 justify-center">Next: Lease details →</button>
            </div>
          </>
        )}
        {step === 'lease' && (
          <>
            <Field label="Lease type" required>
              <Select value={leaseForm.leaseType} onChange={setL('leaseType')} options={LEASE_TYPES} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Lease start date" required error={errors.startDate}>
                <input className="input" type="date" value={leaseForm.startDate} onChange={setL('startDate')} />
              </Field>
              {isFixedTerm ? (
                <Field label="Duration (months)" required error={errors.durationMonths}>
                  <input className="input" type="number" inputMode="numeric" min="1" value={leaseForm.durationMonths} onChange={setL('durationMonths')} placeholder="12" />
                </Field>
              ) : (
                <Field label="Duration">
                  <input className="input bg-surface-50" value="Ongoing (month-to-month)" disabled readOnly />
                </Field>
              )}
            </div>

            {isFixedTerm && (
              <Field label="Lease end date" hint="Auto-calculated from start date + duration">
                <input className="input bg-surface-50" value={computedEndDate ? formatDate(computedEndDate) : '—'} disabled readOnly />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Rent due" required>
                <Select value={leaseForm.rentFrequency} onChange={setL('rentFrequency')} options={RENT_FREQUENCIES} />
              </Field>
              <Field label="Due date" required hint="Day of the period">
                <Select value={leaseForm.dueDay} onChange={setL('dueDay')} options={DUE_DAYS} />
              </Field>
            </div>

            <Field label="Rental amount (ZAR)" required error={errors.rentAmount}>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                <input className="input pl-7" type="number" inputMode="decimal" value={leaseForm.rentAmount} onChange={setL('rentAmount')} placeholder="12 500" />
              </div>
            </Field>
            <Field label="Deposit (ZAR)" required error={errors.depositPaid} hint="Typically 1–2 months' rent">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                <input className="input pl-7" type="number" inputMode="decimal" value={leaseForm.depositPaid} onChange={setL('depositPaid')} placeholder="25 000" />
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
                <div><p className="text-xs text-gray-500">Lease type</p><p className="font-medium">{labelFor(LEASE_TYPES, activeLease.leaseType)}</p></div>
                <div><p className="text-xs text-gray-500">Start date</p><p className="font-medium">{formatDate(activeLease.startDate)}</p></div>
                <div><p className="text-xs text-gray-500">End date</p><p className="font-medium">{activeLease.endDate ? formatDate(activeLease.endDate) : 'Open-ended'}</p></div>
                <div><p className="text-xs text-gray-500">Rent due</p><p className="font-medium">{labelFor(RENT_FREQUENCIES, activeLease.rentFrequency)}{activeLease.dueDay ? ` · day ${activeLease.dueDay}` : ''}</p></div>
                <div><p className="text-xs text-gray-500">Rental amount</p><p className="font-medium">{formatCurrency(activeLease.rentAmount)}</p></div>
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

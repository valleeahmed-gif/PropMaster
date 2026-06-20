import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Building2, MapPin, ChevronRight, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Property, Province } from '../types';
import { Modal, ConfirmDialog, EmptyState, PageHeader, StatusBadge, Tabs, Field, Select } from '../components/UI';
import { formatCurrency, formatDate, PROVINCES } from '../utils';
import { LeasesTab } from './PropertyTabs/LeasesTab';
import { InvoicesTab } from './PropertyTabs/InvoicesTab';
import { PaymentsTab } from './PropertyTabs/PaymentsTab';
import { CostsTab } from './PropertyTabs/CostsTab';
import { MaintenanceTab } from './PropertyTabs/MaintenanceTab';

// ── Property Form Modal ────────────────────────────────────
interface PropertyFormProps {
  open: boolean;
  onClose: () => void;
  property?: Property;
}

function PropertyForm({ open, onClose, property }: PropertyFormProps) {
  const { addProperty, updateProperty, showToast } = useApp();
  const [form, setForm] = useState({
    name: '', address: '', city: '', province: 'Gauteng' as Province,
    rentAmount: '', unitNumber: '', erfSize: '',
  });

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name, address: property.address, city: property.city,
        province: property.province, rentAmount: String(property.rentAmount),
        unitNumber: property.unitNumber || '', erfSize: property.erfSize ? String(property.erfSize) : '',
      });
    } else {
      setForm({ name: '', address: '', city: '', province: 'Gauteng', rentAmount: '', unitNumber: '', erfSize: '' });
    }
  }, [property, open]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Property name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.rentAmount || isNaN(Number(form.rentAmount)) || Number(form.rentAmount) <= 0) e.rentAmount = 'Valid rent amount required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const data = {
      ...form,
      rentAmount: Number(form.rentAmount),
      unitNumber: form.unitNumber || undefined,
      erfSize: form.erfSize ? Number(form.erfSize) : undefined,
    };
    if (property) { updateProperty(property.id, data); showToast('Property updated'); }
    else { addProperty(data); showToast('Property added'); }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={property ? 'Edit property' : 'Add property'}>
      <div className="p-6 space-y-4">
        <Field label="Property name" required error={errors.name}>
          <input className="input" placeholder="e.g. Sandton Heights Apt 4B" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Street address" required error={errors.address}>
          <input className="input" placeholder="12 Rivonia Road" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit number" hint="Optional — e.g. Apt 4B">
            <input className="input" placeholder="4B" value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} />
          </Field>
          <Field label="Erf size (m²)" hint="Optional">
            <input className="input" type="number" inputMode="decimal" placeholder="450" value={form.erfSize} onChange={e => setForm(f => ({ ...f, erfSize: e.target.value }))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" required error={errors.city}>
            <input className="input" placeholder="Sandton" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="Province" required>
            <Select
              value={form.province}
              onChange={e => setForm(f => ({ ...f, province: e.target.value as Province }))}
              options={PROVINCES.map(p => ({ value: p, label: p }))}
            />
          </Field>
        </div>
        <Field label="Monthly rent (ZAR)" required error={errors.rentAmount}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R</span>
            <input className="input pl-7" placeholder="12 500" type="number" inputMode="decimal" min="0" value={form.rentAmount} onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} />
          </div>
        </Field>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 justify-center">{property ? 'Save changes' : 'Add property'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Properties List ────────────────────────────────────────
export function PropertiesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { properties, leases, user, tenants } = useApp();
  const [showAdd, setShowAdd] = useState(searchParams.get('add') === '1');

  const myProperties = properties.filter(p => p.ownerId === user?.id);
  const activeLeases = leases.filter(l => l.status === 'active');

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${myProperties.length} ${myProperties.length === 1 ? 'property' : 'properties'}`}
        action={
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Add property
          </button>
        }
      />

      {myProperties.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 size={24} />}
            title="No properties yet"
            description="Add your first property to start managing leases, invoices, and payments."
            action={<button onClick={() => setShowAdd(true)} className="btn-primary">Add property</button>}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {myProperties.map(prop => {
            const lease = activeLeases.find(l => l.propertyId === prop.id);
            const tenant = lease ? tenants.find(t => t.id === lease.tenantId) : null;
            return (
              <div
                key={prop.id}
                className="card card-lift p-5 cursor-pointer active:scale-[0.99]"
                onClick={() => navigate(`/properties/${prop.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Building2 size={20} className="text-brand-600" />
                  </div>
                  <StatusBadge status={lease ? 'active' : 'draft'} label={lease ? 'Tenanted' : 'Vacant'} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 truncate">{prop.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                  <MapPin size={12} />
                  <span className="truncate">
                    {prop.unitNumber ? `Unit ${prop.unitNumber}, ` : ''}{prop.city}, {prop.province}
                  </span>
                </div>
                <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Monthly rent</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(prop.rentAmount)}</p>
                  </div>
                  {tenant && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Tenant</p>
                      <p className="text-xs font-medium text-gray-700 max-w-[120px] truncate">{tenant.name}</p>
                    </div>
                  )}
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PropertyForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

// ── Property Detail ────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'leases', label: 'Tenants & Leases' },
  { id: 'costs', label: 'Running Costs' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'maintenance', label: 'Maintenance' },
];

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, leases, tenants, invoices, payments, maintenanceRequests, deleteProperty, showToast } = useApp();
  const [tab, setTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const property = properties.find(p => p.id === id);
  if (!property) return (
    <div className="card p-8 text-center">
      <p className="text-gray-500">Property not found.</p>
      <button onClick={() => navigate('/properties')} className="btn-primary mt-4 mx-auto">Back to properties</button>
    </div>
  );

  const activeLease = leases.find(l => l.propertyId === id && l.status === 'active');
  const tenant = activeLease ? tenants.find(t => t.id === activeLease.tenantId) : null;
  const propInvoices = invoices.filter(i => i.propertyId === id);
  const propPayments = payments.filter(p => p.propertyId === id);
  const propMaintenance = maintenanceRequests.filter(m => m.propertyId === id);

  const totalCollected = propPayments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
  const outstanding = propInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);

  const handleDelete = () => {
    deleteProperty(id!);
    showToast('Property deleted');
    navigate('/properties');
  };

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/properties')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to properties
      </button>

      {/* Header Card */}
      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-brand-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{property.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
              {property.address}{property.unitNumber ? `, Unit ${property.unitNumber}` : ''}, {property.city}, {property.province}
              {property.erfSize ? <span className="ml-2 text-gray-400">· {property.erfSize} m²</span> : ''}
            </p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                <span className="font-medium">Rent: {formatCurrency(property.rentAmount)}/mo</span>
                {activeLease && <span className="text-green-700">● Active lease</span>}
                {!activeLease && <span className="text-amber-600">○ Vacant</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowEdit(true)} className="btn-secondary px-3 py-2 gap-1.5 text-xs">
              <Edit2 size={14} /> Edit
            </button>
            <button onClick={() => setShowDelete(true)} className="btn-danger px-3 py-2 gap-1.5 text-xs">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: 'Total collected', value: formatCurrency(totalCollected), color: 'text-green-700' },
                { label: 'Outstanding', value: formatCurrency(outstanding), color: outstanding > 0 ? 'text-red-600' : 'text-gray-900' },
                { label: 'Invoices', value: String(propInvoices.length), color: 'text-gray-900' },
                { label: 'Payments', value: String(propPayments.length), color: 'text-gray-900' },
                { label: 'Maintenance', value: String(propMaintenance.length), color: 'text-gray-900' },
                { label: 'Deposit held', value: activeLease ? formatCurrency(activeLease.depositPaid) : '—', color: 'text-gray-900' },
              ].map(s => (
                <div key={s.label} className="card p-4">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Lease summary */}
            {activeLease && tenant && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm">Current tenant</h3>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-brand-700">
                      {tenant.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{tenant.name}</p>
                    <p className="text-xs text-gray-500">{tenant.email} · {tenant.phone}</p>
                  </div>
                  <StatusBadge status={tenant.inviteStatus} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-100 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Lease starts</p>
                    <p className="font-medium">{formatDate(activeLease.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lease ends</p>
                    <p className="font-medium">{activeLease.endDate ? formatDate(activeLease.endDate) : 'Open-ended'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Rent</p>
                    <p className="font-medium">{formatCurrency(activeLease.rentAmount)}/mo</p>
                  </div>
                </div>
              </div>
            )}

            {!activeLease && (
              <div className="card p-6 border-dashed border-2 text-center">
                <p className="text-sm text-gray-500 mb-3">No active lease. This property is currently vacant.</p>
                <button onClick={() => setTab('leases')} className="btn-primary mx-auto">Add a tenant & lease</button>
              </div>
            )}
          </div>
        )}

        {tab === 'leases' && <LeasesTab propertyId={id!} />}
        {tab === 'invoices' && <InvoicesTab propertyId={id!} />}
        {tab === 'payments' && <PaymentsTab propertyId={id!} />}
        {tab === 'costs' && <CostsTab propertyId={id!} />}
        {tab === 'maintenance' && <MaintenanceTab propertyId={id!} />}
      </div>

      <PropertyForm open={showEdit} onClose={() => setShowEdit(false)} property={property} />
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete property"
        message="This will permanently delete the property and all associated leases, invoices, and payments. This cannot be undone."
        confirmLabel="Delete property"
        danger
      />
    </div>
  );
}

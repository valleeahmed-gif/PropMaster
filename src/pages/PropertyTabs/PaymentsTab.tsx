import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import React, { useState } from 'react';
import { Plus, CreditCard, Trash2, Upload, CheckCircle, AlertCircle, FileText, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal, EmptyState, StatusBadge, Field, Select, Toggle, FileUpload, Spinner } from '../../components/UI';
import { formatCurrency, formatDate, formatMonthYear, MONTHS } from '../../utils';
import { UtilityBreakdown, MaintenanceRequest } from '../../types';
import { supabase } from '../../lib/supabase';
import { UpdateMaintenanceModal } from '../../components/UpdateMaintenanceModal';

// ── Payments Tab ───────────────────────────────────────────
interface Props { propertyId: string; }

function PaymentModal({ open, onClose, propertyId }: { open: boolean; onClose: () => void; propertyId: string }) {
  const { addPayment, leases, invoices, showToast } = useApp();
  const [form, setForm] = useState({ amount: '', paymentDate: '', method: 'eft', invoiceId: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeLease = leases.find(l => l.propertyId === propertyId && l.status === 'active');
  const unpaidInvoices = invoices.filter(i => i.propertyId === propertyId && (i.status === 'sent' || i.status === 'overdue'));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (!form.paymentDate) e.paymentDate = 'Payment date required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate() || !activeLease) return;
    addPayment({
      propertyId,
      leaseId: activeLease.id,
      invoiceId: form.invoiceId || undefined,
      amount: Number(form.amount),
      paymentDate: form.paymentDate,
      method: form.method as any,
      status: 'verified',
      notes: form.notes || undefined,
    });
    showToast('Payment recorded');
    onClose();
    setForm({ amount: '', paymentDate: '', method: 'eft', invoiceId: '', notes: '' });
  };

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <div className="p-6 space-y-4">
        <Field label="Amount (ZAR)" required error={errors.amount}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
            <input className="input pl-7" type="number" inputMode="decimal" placeholder="12 500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date" required error={errors.paymentDate}>
            <input className="input" type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
          </Field>
          <Field label="Payment method">
            <Select
              value={form.method}
              onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              options={[{ value: 'bank_transfer', label: 'EFT / Bank Transfer' }, { value: 'cash', label: 'Cash' }, { value: 'payfast', label: 'PayFast' }, { value: 'other', label: 'Other' }]}
            />
          </Field>
        </div>
        {unpaidInvoices.length > 0 && (
          <Field label="Link to invoice">
            <Select
              value={form.invoiceId}
              onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))}
              placeholder="Select invoice (optional)"
              options={unpaidInvoices.map(i => ({ value: i.id, label: `${i.invoiceNumber} — ${formatCurrency(i.totalAmount)}` }))}
            />
          </Field>
        )}
        <Field label="Notes">
          <input className="input" placeholder="Optional note" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 justify-center">Record payment</button>
        </div>
      </div>
    </Modal>
  );
}

export function PaymentsTab({ propertyId }: Props) {
  const { payments, invoices } = useApp();
  const [showAdd, setShowAdd] = useState(false);

  const propPayments = [...payments.filter(p => p.propertyId === propertyId)]
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const total = propPayments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Payments ({propPayments.length})</h3>
          {propPayments.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Total collected: {formatCurrency(total)}</p>
          )}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2">
          <Plus size={14} /> Record payment
        </button>
      </div>

      {propPayments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CreditCard size={22} />}
            title="No payments yet"
            description="Record a payment once the tenant pays."
            action={<button onClick={() => setShowAdd(true)} className="btn-primary">Record payment</button>}
          />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {propPayments.map(pay => {
            const linkedInv = pay.invoiceId ? invoices.find(i => i.id === pay.invoiceId) : null;
            return (
              <div key={pay.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={16} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{formatDate(pay.paymentDate)}</p>
                  <p className="text-xs text-gray-500">
                    {pay.method.replace('_', ' ').toUpperCase()}
                    {linkedInv && <span className="ml-1.5 text-brand-600 font-medium">· {linkedInv.invoiceNumber}</span>}
                    {pay.notes && <span> · {pay.notes}</span>}
                  </p>
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

      <RecordPaymentModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        propertyId={propertyId}
      />
    </div>
  );
}

// ── Costs Tab ──────────────────────────────────────────────


// ── Breakdown Row ──────────────────────────────────────────
function BreakdownRow({ bd, onUpdate, onDelete }: {
  bd: UtilityBreakdown;
  onUpdate: (id: string, d: Partial<UtilityBreakdown>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(bd.label);
  const [amount, setAmount] = useState(String(bd.amount));

  const save = () => {
    if (!label.trim() || Number(amount) <= 0) return;
    onUpdate(bd.id, { label: label.trim(), amount: Number(amount) });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 border-b border-surface-50 last:border-0">
      {editing ? (
        <>
          <input className="input flex-1 py-1.5 text-sm" value={label}
            onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
          <div className="relative w-28 flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R</span>
            <input className="input pl-5 w-full py-1.5 text-sm" type="number" inputMode="decimal"
              value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <button onClick={save} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0">
            <CheckCircle size={15} />
          </button>
          <button onClick={() => { setEditing(false); setLabel(bd.label); setAmount(String(bd.amount)); }}
            className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 flex-shrink-0">
            <AlertCircle size={15} />
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-900 font-medium">{bd.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                bd.isRecoverable ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {bd.isRecoverable ? '↑ Tenant pays' : '↓ Owner pays'}
              </span>
              {bd.isRecurring && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-brand-50 text-brand-700 flex-shrink-0">
                  🔁 Recurring
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900 flex-shrink-0 w-24 text-right">{formatCurrency(bd.amount)}</span>
          {/* Recoverable toggle */}
          <Toggle checked={bd.isRecoverable} onChange={v => onUpdate(bd.id, { isRecoverable: v })} />
          {/* Recurring toggle */}
          <button
            onClick={() => onUpdate(bd.id, { isRecurring: !bd.isRecurring })}
            title={bd.isRecurring ? 'Recurring monthly — click to disable' : 'Click to make recurring monthly'}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 text-sm ${
              bd.isRecurring
                ? 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                : 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500'
            }`}
          >
            🔁
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-surface-100 text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs">
            Edit
          </button>
          <button onClick={() => onDelete(bd.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 flex-shrink-0">
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  );
}

// ── Costs Tab ──────────────────────────────────────────────
export function CostsTab({ propertyId }: Props) {
  const {
    propertyCosts, utilityBreakdowns,
    addPropertyCost, addUtilityBreakdown,
    updateUtilityBreakdown, deleteUtilityBreakdown,
    showToast, addStatementUpload,
  } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRecoverable, setNewRecoverable] = useState(true);
  const [newRecurring, setNewRecurring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<{ label: string; amount: number; is_recoverable: boolean; selected: boolean }[]>([]);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [lastFileName, setLastFileName] = useState('');
  const [autoPopulating, setAutoPopulating] = useState(false);

  const cost = propertyCosts.find(c => c.propertyId === propertyId && c.month === month && c.year === year);
  const breakdowns = cost ? utilityBreakdowns.filter(b => b.propertyCostId === cost.id) : [];
  const totalRecoverable = breakdowns.filter(b => b.isRecoverable).reduce((s, b) => s + b.amount, 0);
  const totalNonRecoverable = breakdowns.filter(b => !b.isRecoverable).reduce((s, b) => s + b.amount, 0);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const recurringCount = breakdowns.filter(b => b.isRecurring).length;

  const ensureCost = async () => {
    if (cost) return cost;
    return await addPropertyCost({ propertyId, month, year });
  };

  // ── Auto-populate recurring items from previous month ─────
  const autoPopulateFromPrevious = async () => {
    // Find the most recent prior month that has recurring items for this property
    const prevCosts = propertyCosts
      .filter(c => c.propertyId === propertyId && (c.year < year || (c.year === year && c.month < month)))
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

    let recurringItems: UtilityBreakdown[] = [];
    for (const prevCost of prevCosts) {
      const items = utilityBreakdowns.filter(b => b.propertyCostId === prevCost.id && b.isRecurring);
      if (items.length > 0) { recurringItems = items; break; }
    }

    if (recurringItems.length === 0) {
      showToast('No recurring items found in previous months', 'info');
      return;
    }

    setAutoPopulating(true);
    const c = await ensureCost();
    for (const item of recurringItems) {
      await addUtilityBreakdown({
        propertyCostId: c.id,
        label: item.label,
        amount: item.amount,
        isRecoverable: item.isRecoverable,
        isRecurring: true,
      });
    }
    setAutoPopulating(false);
    showToast(`${recurringItems.length} recurring item${recurringItems.length !== 1 ? 's' : ''} added`);
  };

  // Check if this month already has items, and if previous month has recurring items
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevCost = propertyCosts.find(c => c.propertyId === propertyId && c.month === prevMonth && c.year === prevYear);
  const prevRecurringItems = prevCost
    ? utilityBreakdowns.filter(b => b.propertyCostId === prevCost.id && b.isRecurring)
    : [];
  const canAutoPopulate = breakdowns.length === 0 && prevRecurringItems.length > 0;

  // ── Add line item ─────────────────────────────────────────
  const handleAddLine = async () => {
    const labelTrimmed = newLabel.trim();
    const amountNum = Number(newAmount);
    if (!labelTrimmed || !newAmount || amountNum <= 0) {
      showToast('Please enter a label and a valid amount', 'error');
      return;
    }
    setAdding(true);
    try {
      const c = await ensureCost();
      await addUtilityBreakdown({
        propertyCostId: c.id,
        label: labelTrimmed,
        amount: amountNum,
        isRecoverable: newRecoverable,
        isRecurring: newRecurring,
      });
      setNewLabel('');
      setNewAmount('');
      setNewRecurring(false);
      showToast(`${labelTrimmed} added${newRecurring ? ' — will repeat monthly' : ''}`);
    } catch (err) {
      showToast('Failed to save — please try again', 'error');
    } finally {
      setAdding(false);
    }
  };

  const QUICK_LABELS = [
    { label: 'Electricity', recoverable: true },
    { label: 'Water & Sanitation', recoverable: true },
    { label: 'Refuse Removal', recoverable: true },
    { label: 'Levy', recoverable: false },
    { label: 'Rates', recoverable: false },
    { label: 'Gas', recoverable: true },
  ];

  const handleFileUpload = async (file: File) => {
    setExtracting(true);
    setExtractError(null);
    setLastFileName(file.name);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const uploadRecord = await addStatementUpload({
        propertyId,
        filePath: `statements/${propertyId}/${Date.now()}-${file.name}`,
        fileName: file.name,
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await fetch(
        'https://cghiodbvbggizghxuvna.supabase.co/functions/v1/extract-statement',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ fileBase64: base64, fileName: file.name, propertyId, uploadId: uploadRecord.id }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Extraction failed');
      if (result.items.length === 0) {
        setExtractError('No line items found. Try a different statement or add manually.');
        setExtracting(false);
        return;
      }
      setExtractedItems(result.items.map((item: any) => ({ ...item, selected: true })));
      setExtracting(false);
      setShowExtractModal(true);
      showToast(`${result.items.length} items extracted — please review`);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setExtracting(false);
    }
  };

  const confirmExtraction = async () => {
    const c = await ensureCost();
    const selected = extractedItems.filter(i => i.selected);
    for (const item of selected) {
      await addUtilityBreakdown({
        propertyCostId: c.id,
        label: item.label,
        amount: item.amount,
        isRecoverable: item.is_recoverable,
        isRecurring: false,
      });
    }
    setShowExtractModal(false);
    setExtractedItems([]);
    showToast(`${selected.length} items added from statement`);
  };

  return (
    <div className="space-y-4">

      {/* Month selector */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Running costs</h3>
          <span className="text-xs text-gray-400">{formatMonthYear(month, year)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={month} onChange={e => setMonth(Number(e.target.value))} options={MONTHS.map(m2 => ({ value: m2.value, label: m2.label }))} />
          <Select value={year} onChange={e => setYear(Number(e.target.value))} options={years.map(y => ({ value: y, label: String(y) }))} />
        </div>
        {cost && breakdowns.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-100 text-center">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(cost.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tenant pays</p>
              <p className="text-sm font-bold text-green-700">{formatCurrency(totalRecoverable)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Owner pays</p>
              <p className="text-sm font-bold text-gray-500">{formatCurrency(totalNonRecoverable)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Recurring explanation */}
      <div className="flex items-start gap-3 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
        <span className="text-base flex-shrink-0 mt-0.5">🔁</span>
        <div>
          <p className="text-xs font-semibold text-brand-900 mb-0.5">Recurring costs</p>
          <p className="text-xs text-brand-700 leading-relaxed">
            Mark fixed monthly costs like <strong>levy</strong> or <strong>body corporate</strong> as recurring.
            When you open a new month, click <strong>Copy recurring items</strong> to auto-fill them — no re-entering needed. Variable costs like electricity should not be marked recurring.
          </p>
        </div>
      </div>

      {/* Auto-populate banner — shown when this month is empty but previous has recurring */}
      {canAutoPopulate && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 rounded-xl border border-green-200">
          <span className="text-lg flex-shrink-0">✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-900">
              {prevRecurringItems.length} recurring item{prevRecurringItems.length !== 1 ? 's' : ''} from {formatMonthYear(prevMonth, prevYear)} available
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              {prevRecurringItems.map(i => i.label).join(', ')}
            </p>
          </div>
          <button
            onClick={autoPopulateFromPrevious}
            disabled={autoPopulating}
            className="btn-primary text-xs px-3 py-2 flex-shrink-0 gap-1.5"
          >
            {autoPopulating ? (
              <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Copying…</>
            ) : (
              <>🔁 Copy recurring items</>
            )}
          </button>
        </div>
      )}

      {/* Breakdown list */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Items for {formatMonthYear(month, year)}
          </h3>
          <div className="flex items-center gap-2">
            {recurringCount > 0 && (
              <span className="text-xs text-brand-600 font-medium">{recurringCount} recurring</span>
            )}
            {breakdowns.length > 0 && (
              <span className="text-xs text-gray-400">{breakdowns.length} item{breakdowns.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {breakdowns.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">No costs added for this month yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add manually, copy recurring items, or upload a statement.</p>
          </div>
        )}

        {breakdowns.map(bd => (
          <BreakdownRow
            key={bd.id}
            bd={bd}
            onUpdate={updateUtilityBreakdown}
            onDelete={(id) => { deleteUtilityBreakdown(id); showToast('Item removed'); }}
          />
        ))}

        {/* Quick add + manual add */}
        <div className="px-4 py-3.5 border-t border-surface-100 bg-surface-50">
          <p className="text-xs font-medium text-gray-500 mb-2">Quick add</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_LABELS.filter(q => !breakdowns.find(b => b.label.toLowerCase() === q.label.toLowerCase())).map(q => (
              <button
                key={q.label}
                onClick={() => { setNewLabel(q.label); setNewRecoverable(q.recoverable); }}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  newLabel === q.label
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-surface-200 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                {q.label}
                <span className={`ml-1 ${newLabel === q.label ? 'text-brand-200' : 'text-gray-400'}`}>
                  {q.recoverable ? '↑' : '↓'}
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs font-medium text-gray-500 mb-2">Add manually</p>
          <div className="space-y-2">
            <div className="flex gap-2 items-start flex-wrap sm:flex-nowrap">
              <input
                className="input flex-1 min-w-0 text-sm py-2.5"
                placeholder="Item label (e.g. Levy)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddLine()}
              />
              <div className="relative w-32 flex-shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R</span>
                <input
                  className="input pl-7 w-full text-sm py-2.5"
                  type="number" inputMode="decimal" placeholder="0.00"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Toggle checked={newRecoverable} onChange={setNewRecoverable} />
                <span className={`text-xs font-medium ${newRecoverable ? 'text-green-700' : 'text-gray-500'}`}>
                  {newRecoverable ? 'Tenant pays' : 'Owner pays'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Toggle checked={newRecurring} onChange={setNewRecurring} />
                <span className={`text-xs font-medium ${newRecurring ? 'text-brand-700' : 'text-gray-400'}`}>
                  🔁 Recurring monthly
                </span>
              </div>
              <button
                onClick={handleAddLine}
                disabled={adding || !newLabel.trim() || !newAmount || Number(newAmount) <= 0}
                className="btn-primary text-xs px-4 py-2.5 flex-shrink-0 gap-1.5 disabled:opacity-40 ml-auto"
              >
                {adding ? (
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5"><Plus size={14} /> Add</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statement upload */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">Upload levy / utility statement</h3>
          <span className="badge-blue text-xs">AI powered</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Upload a COJ, eThekwini, City of Cape Town or body corporate levy PDF — Claude AI extracts every line item for you to review.
        </p>
        {extracting ? (
          <div className="flex flex-col items-center gap-4 py-10 border-2 border-dashed border-brand-200 rounded-xl bg-brand-50">
            <Spinner size={36} />
            <div className="text-center">
              <p className="text-sm font-medium text-brand-900">Reading statement…</p>
              <p className="text-xs text-brand-600 mt-1">Claude is extracting line items from <span className="font-medium">{lastFileName}</span></p>
            </div>
          </div>
        ) : extractError ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Extraction failed</p>
                <p className="text-xs text-red-600 mt-0.5">{extractError}</p>
              </div>
            </div>
            <button onClick={() => setExtractError(null)} className="btn-secondary text-xs gap-1.5 w-full justify-center">
              <RotateCcw size={13} /> Try again
            </button>
          </div>
        ) : (
          <FileUpload onFile={handleFileUpload} accept=".pdf" label="Upload PDF statement" />
        )}
      </div>

      {/* Extraction review modal */}
      <Modal open={showExtractModal} onClose={() => setShowExtractModal(false)} title="Review extracted items" size="md">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-brand-50 rounded-xl border border-brand-100">
            <FileText size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-brand-900">{lastFileName}</p>
              <p className="text-xs text-brand-600 mt-0.5">
                {extractedItems.length} items found. Tick to include. Click the badge to toggle who pays.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {extractedItems.map((item, i) => (
              <div key={i}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  item.selected ? 'border-brand-200 bg-brand-50' : 'border-surface-200 bg-white opacity-50'
                }`}
                onClick={() => setExtractedItems(p => p.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
              >
                <input type="checkbox" checked={item.selected}
                  onChange={e => { e.stopPropagation(); setExtractedItems(p => p.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x)); }}
                  className="rounded accent-brand-600 w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-900 font-medium">{item.label}</span>
                <div
                  onClick={e => { e.stopPropagation(); setExtractedItems(p => p.map((x, j) => j === i ? { ...x, is_recoverable: !x.is_recoverable } : x)); }}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer select-none transition-colors flex-shrink-0 ${
                    item.is_recoverable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {item.is_recoverable ? 'Tenant pays' : 'Owner pays'}
                </div>
                <span className="text-sm font-bold text-gray-900 w-20 text-right flex-shrink-0">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
          {extractedItems.some(i => i.selected) && (
            <div className="pt-2 border-t border-surface-200 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tenant pays</span>
                <span className="font-medium text-green-700">{formatCurrency(extractedItems.filter(i => i.selected && i.is_recoverable).reduce((s, i) => s + i.amount, 0))}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Owner pays</span>
                <span className="font-medium text-gray-700">{formatCurrency(extractedItems.filter(i => i.selected && !i.is_recoverable).reduce((s, i) => s + i.amount, 0))}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1 border-t border-surface-100">
                <span>Total adding</span>
                <span>{formatCurrency(extractedItems.filter(i => i.selected).reduce((s, i) => s + i.amount, 0))}</span>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowExtractModal(false); setExtractedItems([]); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={confirmExtraction} disabled={!extractedItems.some(i => i.selected)} className="btn-primary flex-1 justify-center">
              <CheckCircle size={15} /> Add {extractedItems.filter(i => i.selected).length} items
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Maintenance Tab ────────────────────────────────────────
// ── Maintenance Tab ────────────────────────────────────────
export function MaintenanceTab({ propertyId }: Props) {
  const { maintenanceRequests, addMaintenanceRequest, leases, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [updating, setUpdating] = useState<MaintenanceRequest | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const activeLease = leases.find(l => l.propertyId === propertyId && l.status === 'active');
  const requests = [...maintenanceRequests.filter(m => m.propertyId === propertyId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleAdd = () => {
    if (!form.title.trim()) return;
    addMaintenanceRequest({
      propertyId,
      leaseId: activeLease?.id,
      tenantId: activeLease?.tenantId,
      title: form.title.trim(),
      description: form.description,
      status: 'open',
      priority: form.priority as any,
    });
    showToast('Maintenance request added');
    setShowAdd(false);
    setForm({ title: '', description: '', priority: 'medium' });
  };

  const statusColors: Record<string, string> = {
    open:        'bg-gray-100 text-gray-600',
    in_progress: 'bg-amber-50 text-amber-700',
    resolved:    'bg-green-50 text-green-700',
    closed:      'bg-gray-100 text-gray-500',
  };
  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-500', low: 'bg-gray-400',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Maintenance ({requests.length})</h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2"><Plus size={14} /> Add request</button>
      </div>

      {requests.length === 0 ? (
        <div className="card">
          <EmptyState icon={<AlertCircle size={22} />} title="No maintenance requests" description="No issues have been logged for this property." action={<button onClick={() => setShowAdd(true)} className="btn-primary">Log request</button>} />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {requests.map(req => (
            <div key={req.id} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${priorityDot[req.priority]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{req.title}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[req.status]}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => setUpdating(req)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 font-medium transition-colors"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                  {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
                  {req.resolutionNote && (
                    <div className="mt-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-semibold text-green-700 mb-0.5">Resolution</p>
                      <p className="text-xs text-green-800 leading-relaxed">{req.resolutionNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatDate(req.createdAt)}</p>
                </div>
              </div>
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
            <textarea className="input resize-none" rows={3} placeholder="Details about the issue…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} options={[
              { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
            ]} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleAdd} className="btn-primary flex-1 justify-center">Add request</button>
          </div>
        </div>
      </Modal>

      {updating && (
        <UpdateMaintenanceModal request={updating} onClose={() => setUpdating(null)} />
      )}
    </div>
  );
}

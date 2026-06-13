import React, { useState, useEffect } from 'react';
import { Plus, FileText, Send, CreditCard, Trash2, ChevronDown, ChevronUp, Edit2, AlertTriangle, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal, ConfirmDialog, EmptyState, StatusBadge, Field, Select } from '../../components/UI';
import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import { Invoice, InvoiceLineItem } from '../../types';
import { formatCurrency, formatDate, formatMonthYear, MONTHS } from '../../utils';
import { supabase } from '../../lib/supabase';

interface Props { propertyId: string; }

// ── Create Invoice Wizard (2-step) ─────────────────────────
function InvoiceWizard({ open, onClose, propertyId }: { open: boolean; onClose: () => void; propertyId: string }) {
  const { leases, propertyCosts, utilityBreakdowns, addInvoice, showToast } = useApp();

  const activeLease = leases.find(l => l.propertyId === propertyId && l.status === 'active');
  const now = new Date();
  const [step, setStep] = useState<1 | 2>(1);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // When month/year changes, compute available costs
  const cost = propertyCosts.find(c => c.propertyId === propertyId && c.month === month && c.year === year);
  const recoverableBreakdowns = cost
    ? utilityBreakdowns.filter(b => b.propertyCostId === cost.id && b.isRecoverable)
    : [];

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
      setDueDate('');
      setLineItems([]);
    }
  }, [open]);

  if (!activeLease) return (
    <Modal open={open} onClose={onClose} title="Create invoice">
      <div className="p-6 text-center text-sm text-gray-500">
        No active lease found for this property. Add a tenant and lease first.
      </div>
    </Modal>
  );

  // ── Step 1: Pick month, due date, and which costs to include ──
  const handleNextStep = () => {
    if (!dueDate) return;
    // Build initial line items: rent first, then any recoverable costs the user includes
    const items: InvoiceLineItem[] = [
      {
        description: `Monthly Rent — ${MONTHS.find(m2 => m2.value === month)?.label} ${year}`,
        amount: activeLease.rentAmount,
      },
    ];
    setLineItems(items);
    setStep(2);
  };

  // ── Step 2: Edit line items before creating draft ──────────
  const addCostItems = (include: boolean) => {
    if (!include) return;
    const costLines = recoverableBreakdowns.map(b => ({
      description: `${b.label} recovery`,
      amount: b.amount,
    }));
    setLineItems(prev => {
      // Avoid duplicating if already added
      const existing = new Set(prev.map(l => l.description));
      return [...prev, ...costLines.filter(l => !existing.has(l.description))];
    });
  };

  const updateItem = (i: number, field: keyof InvoiceLineItem, val: string) =>
    setLineItems(prev => prev.map((l, idx) => idx === i
      ? { ...l, [field]: field === 'amount' ? Number(val) : val }
      : l
    ));

  const removeItem = (i: number) =>
    setLineItems(prev => prev.filter((_, idx) => idx !== i));

  const addBlankItem = () =>
    setLineItems(prev => [...prev, { description: '', amount: 0 }]);

  const total = lineItems.reduce((s, l) => s + l.amount, 0);
  const [costsAdded, setCostsAdded] = useState(false);

  const handleCreate = async () => {
    if (!dueDate || lineItems.length === 0) return;
    setSaving(true);
    try {
      await addInvoice({
        propertyId,
        leaseId: activeLease.id,
        month, year, dueDate,
        lineItems,
        totalAmount: total,
        status: 'draft',
      });
      showToast('Invoice created as draft — edit anytime before sending');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 1 ? 'New invoice — step 1 of 2' : 'New invoice — step 2 of 2'} size="lg">
      {step === 1 && (
        <div className="p-6 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold">1</div>
            <span className="text-xs font-medium text-gray-700">Select billing period & due date</span>
            <div className="flex-1 h-px bg-surface-200" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-200 text-gray-400 text-xs font-bold">2</div>
            <span className="text-xs text-gray-400">Review & edit line items</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Month" required>
              <Select value={month} onChange={e => setMonth(Number(e.target.value))} options={MONTHS.map(m2 => ({ value: m2.value, label: m2.label }))} />
            </Field>
            <Field label="Year" required>
              <Select value={year} onChange={e => setYear(Number(e.target.value))} options={years.map(y => ({ value: y, label: String(y) }))} />
            </Field>
            <Field label="Due date" required>
              <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>
          </div>

          {/* Running costs status for selected month */}
          <div className={`rounded-xl border p-4 ${cost && recoverableBreakdowns.length > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            {cost && recoverableBreakdowns.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-green-900 mb-2">
                  ✓ Running costs found for {formatMonthYear(month, year)}
                </p>
                <div className="space-y-1">
                  {recoverableBreakdowns.map(b => (
                    <div key={b.id} className="flex justify-between text-xs text-green-700">
                      <span>{b.label} recovery</span>
                      <span className="font-medium">{formatCurrency(b.amount)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-700 mt-2 font-medium">
                  These will be offered as line items in the next step.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      No running costs for {formatMonthYear(month, year)}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      You can still create the invoice with just the rent amount, or add running costs in the Running Costs tab first.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleNextStep} disabled={!dueDate} className="btn-primary flex-1 justify-center">
              Next: Review line items →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="p-6 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold">✓</div>
            <span className="text-xs text-gray-400">Period & due date</span>
            <div className="flex-1 h-px bg-brand-200" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold">2</div>
            <span className="text-xs font-medium text-gray-700">Review & edit line items</span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatMonthYear(month, year)} · Due {formatDate(dueDate)}</span>
            <button onClick={() => setStep(1)} className="text-brand-600 hover:underline">← Change period</button>
          </div>

          {/* Running costs add prompt — shown once */}
          {recoverableBreakdowns.length > 0 && !costsAdded && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-900 mb-1">Add utility recoveries?</p>
              <p className="text-xs text-brand-700 mb-3">
                Running costs for {formatMonthYear(month, year)} are available ({formatCurrency(recoverableBreakdowns.reduce((s,b) => s+b.amount, 0))} total). Add them as line items?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { addCostItems(true); setCostsAdded(true); }}
                  className="btn-primary text-xs px-3 py-2 gap-1"
                >
                  ✓ Yes, add {recoverableBreakdowns.length} cost item{recoverableBreakdowns.length !== 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => setCostsAdded(true)}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  Skip — rent only
                </button>
              </div>
            </div>
          )}

          {/* Editable line items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line items</p>
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 p-2.5 rounded-xl border ${i === 0 ? 'bg-brand-50 border-brand-100' : 'bg-surface-50 border-surface-200'}`}>
                  <input
                    className="flex-1 bg-transparent text-sm text-gray-800 outline-none font-medium min-w-0"
                    value={item.description}
                    onChange={e => updateItem(i, 'description', e.target.value)}
                    placeholder="Description"
                  />
                  <div className="relative flex-shrink-0 w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">R</span>
                    <input
                      className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none text-right pr-1 pl-5"
                      type="number"
                      inputMode="decimal"
                      value={item.amount || ''}
                      onChange={e => updateItem(i, 'amount', e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => removeItem(i)}
                    className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addBlankItem} className="btn-secondary text-xs gap-1.5 mt-2">
              <Plus size={13} /> Add line item
            </button>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-200">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">← Back</button>
            <button
              onClick={handleCreate}
              disabled={saving || lineItems.length === 0 || !dueDate}
              className="btn-primary flex-1 justify-center gap-2"
            >
              {saving ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
              ) : 'Create draft invoice'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Edit Draft Invoice Modal ───────────────────────────────
function EditInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { updateInvoice, showToast } = useApp();
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(invoice.lineItems);
  const [saving, setSaving] = useState(false);

  const total = lineItems.reduce((s, l) => s + l.amount, 0);

  const updateItem = (i: number, field: keyof InvoiceLineItem, val: string) =>
    setLineItems(prev => prev.map((l, idx) => idx === i
      ? { ...l, [field]: field === 'amount' ? Number(val) : val }
      : l
    ));

  const removeItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const addBlankItem = () => setLineItems(prev => [...prev, { description: '', amount: 0 }]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInvoice(invoice.id, { dueDate, lineItems, totalAmount: total });
      showToast('Invoice updated');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Edit draft — ${invoice.invoiceNumber}`} size="lg">
      <div className="p-6 space-y-4">
        <Field label="Due date" required>
          <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line items</p>
          <div className="space-y-2">
            {lineItems.map((item, i) => (
              <div key={i} className={`flex items-center gap-2 p-2.5 rounded-xl border ${i === 0 ? 'bg-brand-50 border-brand-100' : 'bg-surface-50 border-surface-200'}`}>
                <input
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none font-medium min-w-0"
                  value={item.description}
                  onChange={e => updateItem(i, 'description', e.target.value)}
                />
                <div className="relative flex-shrink-0 w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">R</span>
                  <input
                    className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none text-right pr-1 pl-5"
                    type="number"
                    inputMode="decimal"
                    value={item.amount || ''}
                    onChange={e => updateItem(i, 'amount', e.target.value)}
                  />
                </div>
                <button onClick={() => removeItem(i)} className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addBlankItem} className="btn-secondary text-xs gap-1.5 mt-2">
            <Plus size={13} /> Add line item
          </button>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-surface-200">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center gap-2">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Invoice Row ────────────────────────────────────────────
function InvoiceRow({ inv, onMarkSent, onRecordPayment, onEdit, onDelete, onSendEmail }: {
  inv: Invoice;
  onMarkSent: (inv: Invoice) => void;
  onRecordPayment: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onSendEmail: (inv: Invoice) => void;
}) {
  const { payments } = useApp();
  const [expanded, setExpanded] = useState(false);
  const linkedPayments = payments.filter(p => p.invoiceId === inv.id);

  return (
    <div className="border-b border-surface-100 last:border-0">
      <div
        className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 px-4 py-4 cursor-pointer hover:bg-surface-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900">{inv.invoiceNumber}</span>
            <StatusBadge status={inv.status} />
            {inv.status === 'draft' && (
              <span className="text-xs text-gray-400 italic">editable</span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatMonthYear(inv.month, inv.year)} · Due {formatDate(inv.dueDate)}
          </p>
          {inv.status === 'paid' && linkedPayments.length > 0 && (
            <p className="text-xs text-green-600 font-medium mt-0.5">
              ✓ Paid {formatDate(linkedPayments[0].paymentDate)} · {linkedPayments[0].method.replace('_', ' ').toUpperCase()}
            </p>
          )}
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 flex-shrink-0">
          <p className="text-base font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {inv.status === 'draft' && (
              <>
                <button onClick={() => onEdit(inv)} className="btn-secondary text-xs px-2 py-1.5 gap-1">
                  <Edit2 size={11} /> Edit
                </button>
                <button onClick={() => onSendEmail(inv)} className="btn-primary text-xs px-2 py-1.5 gap-1">
                  <Mail size={11} /> Send email
                </button>
                <button onClick={() => onMarkSent(inv)} className="btn-secondary text-xs px-2 py-1.5 gap-1">
                  <Send size={11} /> Mark sent
                </button>
                <button onClick={() => onDelete(inv)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </>
            )}
            {(inv.status === 'sent' || inv.status === 'overdue') && (
              <>
                <button onClick={() => onSendEmail(inv)} className="btn-secondary text-xs px-2 py-1.5 gap-1">
                  <Mail size={11} /> Resend
                </button>
                <button onClick={() => onRecordPayment(inv)} className="btn-primary text-xs px-2.5 py-1.5 gap-1">
                  <CreditCard size={12} /> Record payment
                </button>
              </>
            )}
            <button onClick={e => { e.stopPropagation(); setExpanded(x => !x); }} className="p-1.5 text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-surface-50 border-t border-surface-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Line items</p>
          <div className="space-y-1.5 mb-4">
            {inv.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span>{li.description}</span>
                <span className="font-medium">{formatCurrency(li.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold text-gray-900 pt-2 border-t border-surface-200">
              <span>Total</span>
              <span>{formatCurrency(inv.totalAmount)}</span>
            </div>
          </div>
          {linkedPayments.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payments received</p>
              <div className="space-y-1.5">
                {linkedPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-green-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <CreditCard size={12} />
                      <span>{formatDate(p.paymentDate)} · {p.method.replace('_', ' ').toUpperCase()}</span>
                      {p.notes && <span className="text-green-600">· {p.notes}</span>}
                    </div>
                    <span className="font-bold text-green-800">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {linkedPayments.length === 0 && inv.status !== 'draft' && (
            <p className="text-xs text-gray-400">No payment recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Invoices Tab ───────────────────────────────────────────
export function InvoicesTab({ propertyId }: Props) {
  const { invoices, updateInvoice, deleteInvoice, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const propInvoices = [...invoices.filter(i => i.propertyId === propertyId)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleMarkSent = async (inv: Invoice) => {
    await updateInvoice(inv.id, { status: 'sent' });
    showToast(`${inv.invoiceNumber} marked as sent`);
  };

  const handleSendEmail = async (inv: Invoice) => {
    setSendingInvoiceId(inv.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        'https://cghiodbvbggizghxuvna.supabase.co/functions/v1/send-invoice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ invoiceId: inv.id }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to send');
      await updateInvoice(inv.id, { status: 'sent' });
      showToast(`Invoice emailed to ${result.sentTo}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send invoice', 'error');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingInvoice) return;
    await deleteInvoice(deletingInvoice.id);
    showToast('Draft invoice deleted');
    setDeletingInvoice(null);
  };

  const totalOutstanding = propInvoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Invoices ({propInvoices.length})</h3>
          {totalOutstanding > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-0.5">{formatCurrency(totalOutstanding)} outstanding</p>
          )}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2">
          <Plus size={14} /> New invoice
        </button>
      </div>

      {propInvoices.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={22} />}
            title="No invoices yet"
            description="Create your first invoice. Running costs will be pulled in automatically."
            action={<button onClick={() => setShowAdd(true)} className="btn-primary">Create invoice</button>}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {propInvoices.map(inv => (
            <InvoiceRow
              key={inv.id}
              inv={inv}
              onMarkSent={handleMarkSent}
              onRecordPayment={setPayingInvoice}
              onEdit={setEditingInvoice}
              onDelete={setDeletingInvoice}
              onSendEmail={handleSendEmail}
            />
          ))}
        </div>
      )}

      <InvoiceWizard open={showAdd} onClose={() => setShowAdd(false)} propertyId={propertyId} />

      {editingInvoice && (
        <EditInvoiceModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} />
      )}

      <RecordPaymentModal
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
        invoice={payingInvoice ?? undefined}
      />

      <ConfirmDialog
        open={!!deletingInvoice}
        onClose={() => setDeletingInvoice(null)}
        onConfirm={handleDelete}
        title="Delete draft invoice"
        message={`Delete ${deletingInvoice?.invoiceNumber}? This cannot be undone.`}
        confirmLabel="Delete invoice"
        danger
      />
    </div>
  );
}

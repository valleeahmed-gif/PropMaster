import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal, Field, Select, StatusBadge } from './UI';
import { Invoice } from '../types';
import { formatCurrency, formatDate, formatMonthYear, today } from '../utils';

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  // When opened from an invoice row, pass the invoice
  invoice?: Invoice;
  // When opened standalone (from Payments tab), pass the propertyId
  propertyId?: string;
}

const METHODS = [
  { value: 'eft', label: 'EFT / Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'payfast', label: 'PayFast' },
  { value: 'other', label: 'Other' },
];

export function RecordPaymentModal({ open, onClose, invoice, propertyId }: RecordPaymentModalProps) {
  const { addPayment, updateInvoice, leases, invoices, properties, showToast } = useApp();

  // Derive the effective property — from invoice or explicit prop
  const effectivePropertyId = invoice?.propertyId ?? propertyId ?? '';

  // All unpaid invoices for this property (for standalone mode)
  const unpaidInvoices = invoices.filter(i =>
    i.propertyId === effectivePropertyId &&
    (i.status === 'sent' || i.status === 'overdue' || i.status === 'draft')
  );

  const activeLease = leases.find(
    l => l.propertyId === effectivePropertyId && l.status === 'active'
  );

  const [form, setForm] = useState({
    amount: '',
    paymentDate: today(),
    method: 'eft',
    linkedInvoiceId: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // When an invoice is passed in, pre-fill amount and link
  useEffect(() => {
    if (open) {
      setForm({
        amount: invoice ? String(invoice.totalAmount) : '',
        paymentDate: today(),
        method: 'eft',
        linkedInvoiceId: invoice?.id ?? '',
        notes: '',
      });
      setErrors({});
    }
  }, [open, invoice]);

  // The invoice that will be marked paid — either passed in or selected in form
  const linkedInvoice = invoice ?? invoices.find(i => i.id === form.linkedInvoiceId);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (!form.paymentDate) e.paymentDate = 'Payment date required';
    if (!activeLease) e.general = 'No active lease found for this property';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !activeLease) return;
    setSaving(true);
    try {
      await addPayment({
        propertyId: effectivePropertyId,
        leaseId: activeLease.id,
        invoiceId: linkedInvoice?.id,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method as any,
        status: 'verified',
        notes: form.notes || undefined,
      });
      // addPayment already marks invoice as paid if invoiceId is set
      // But if we came from an invoice that was draft/sent, make sure status updates
      if (linkedInvoice && linkedInvoice.status !== 'paid') {
        await updateInvoice(linkedInvoice.id, { status: 'paid' });
      }
      const invLabel = linkedInvoice ? ` for ${linkedInvoice.invoiceNumber}` : '';
      showToast(`Payment of ${formatCurrency(Number(form.amount))}${invLabel} recorded`);
      onClose();
    } catch (err) {
      showToast('Failed to record payment — please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isInvoiceMode = !!invoice;
  const title = isInvoiceMode ? `Record payment — ${invoice.invoiceNumber}` : 'Record payment';

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="p-6 space-y-4">

        {/* Invoice context banner — shown when opened from an invoice */}
        {linkedInvoice && (
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{linkedInvoice.invoiceNumber}</span>
                  <StatusBadge status={linkedInvoice.status} />
                </div>
                <p className="text-xs text-gray-500">
                  {formatMonthYear(linkedInvoice.month, linkedInvoice.year)} · Due {formatDate(linkedInvoice.dueDate)}
                </p>
                <div className="mt-2 space-y-0.5">
                  {linkedInvoice.lineItems.slice(0, 3).map((li, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-400">
                      <span>{li.description}</span>
                      <span>{formatCurrency(li.amount)}</span>
                    </div>
                  ))}
                  {linkedInvoice.lineItems.length > 3 && (
                    <p className="text-xs text-gray-400">+{linkedInvoice.lineItems.length - 3} more items</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">Invoice total</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(linkedInvoice.totalAmount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Invoice selector — only in standalone mode */}
        {!isInvoiceMode && unpaidInvoices.length > 0 && (
          <Field label="Link to invoice">
            <Select
              value={form.linkedInvoiceId}
              onChange={e => {
                const inv = invoices.find(i => i.id === e.target.value);
                setForm(f => ({
                  ...f,
                  linkedInvoiceId: e.target.value,
                  amount: inv ? String(inv.totalAmount) : f.amount,
                }));
              }}
              placeholder="Select invoice (optional)"
              options={unpaidInvoices.map(i => ({
                value: i.id,
                label: `${i.invoiceNumber} — ${formatMonthYear(i.month, i.year)} — ${formatCurrency(i.totalAmount)}`,
              }))}
            />
          </Field>
        )}

        {/* Amount */}
        <Field label="Amount received (ZAR)" required error={errors.amount}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R</span>
            <input
              className="input pl-8 text-lg font-semibold"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>
          {linkedInvoice && Number(form.amount) > 0 && Number(form.amount) !== linkedInvoice.totalAmount && (
            <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${
              Number(form.amount) < linkedInvoice.totalAmount ? 'text-amber-600' : 'text-green-600'
            }`}>
              {Number(form.amount) < linkedInvoice.totalAmount ? (
                <><AlertCircle size={12} /> Partial payment — {formatCurrency(linkedInvoice.totalAmount - Number(form.amount))} still outstanding</>
              ) : (
                <><CheckCircle size={12} /> Includes {formatCurrency(Number(form.amount) - linkedInvoice.totalAmount)} overpayment</>
              )}
            </div>
          )}
        </Field>

        {/* Date + Method */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date" required error={errors.paymentDate}>
            <input
              className="input"
              type="date"
              value={form.paymentDate}
              onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
            />
          </Field>
          <Field label="Method">
            <Select
              value={form.method}
              onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              options={METHODS}
            />
          </Field>
        </div>

        {/* Notes */}
        <Field label="Reference / notes">
          <input
            className="input"
            placeholder="e.g. proof of payment reference"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </Field>

        {errors.general && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle size={12} /> {errors.general}
          </p>
        )}

        {/* What happens on confirm */}
        {linkedInvoice && (
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-xs text-green-800">
            <span className="font-semibold">On confirm:</span> payment recorded + {linkedInvoice.invoiceNumber} marked as paid.
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.amount || !form.paymentDate}
            className="btn-primary flex-1 justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CreditCard size={15} />
                Record payment
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

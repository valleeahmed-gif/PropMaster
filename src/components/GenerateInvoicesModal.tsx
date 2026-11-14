import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal, Select } from './UI';
import { buildInvoiceDraft, dueDateFor, invoiceForMonth } from '../lib/billing';
import { errorMessage, formatCurrency, formatDate, formatMonthYear, MONTHS, today } from '../utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Monthly invoice run: one invoice per active lease for the chosen month —
 * rent (when due) plus that month's recoverable running costs, due on the
 * lease's due day. Leases that already have an invoice are skipped.
 */
export function GenerateInvoicesModal({ open, onClose }: Props) {
  const { leases, properties, tenants, invoices, propertyCosts, utilityBreakdowns, addInvoice, showToast } = useApp();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [markSent, setMarkSent] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (open) {
      const d = new Date();
      setMonth(d.getMonth() + 1);
      setYear(d.getFullYear());
      setMarkSent(false);
      setExcluded(new Set());
      setDone(0);
    }
  }, [open]);

  const rows = useMemo(() => leases
    .filter(l => l.status === 'active')
    .map(lease => {
      const property = properties.find(p => p.id === lease.propertyId);
      const tenant = tenants.find(t => t.id === lease.tenantId);
      const existing = invoiceForMonth(invoices, lease.id, month, year);
      const draft = buildInvoiceDraft(lease, month, year, propertyCosts, utilityBreakdowns);
      const dueDate = dueDateFor(month, year, lease.dueDay);
      let skip: string | null = null;
      if (existing) skip = `Already invoiced (${existing.invoiceNumber})`;
      else if (draft.lineItems.length === 0) skip = draft.rentIncluded ? 'Nothing to bill' : 'No rent due this month';
      else if (draft.totalAmount <= 0) skip = 'Nothing to bill';
      return { lease, property, tenant, draft, dueDate, skip };
    })
    .filter(r => !!r.property)
    .sort((a, b) => (a.property!.name).localeCompare(b.property!.name)),
  [leases, properties, tenants, invoices, propertyCosts, utilityBreakdowns, month, year]);

  const ready = rows.filter(r => !r.skip);
  const chosen = ready.filter(r => !excluded.has(r.lease.id));
  const total = chosen.reduce((s, r) => s + r.draft.totalAmount, 0);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const toggle = (id: string) => setExcluded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const run = async () => {
    if (busy || chosen.length === 0) return;
    setBusy(true);
    setDone(0);
    let created = 0;
    try {
      for (const r of chosen) {
        const status = markSent ? (r.dueDate < today() ? 'overdue' : 'sent') : 'draft';
        await addInvoice({
          propertyId: r.lease.propertyId, leaseId: r.lease.id, month, year,
          dueDate: r.dueDate, lineItems: r.draft.lineItems, totalAmount: r.draft.totalAmount, status,
        });
        created++;
        setDone(created);
      }
      showToast(`${created} invoice${created === 1 ? '' : 's'} created for ${formatMonthYear(month, year)}${markSent ? '' : ' as drafts'}`);
      onClose();
    } catch (err) {
      showToast(`Created ${created} of ${chosen.length} invoices — ${errorMessage(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Generate monthly invoices" size="lg">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Creates one invoice per active lease: rent plus that month's recoverable running costs, due on each lease's due day.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Select value={month} onChange={e => { setMonth(Number(e.target.value)); setExcluded(new Set()); }} options={MONTHS} aria-label="Billing month" disabled={busy} />
          <Select value={year} onChange={e => { setYear(Number(e.target.value)); setExcluded(new Set()); }} options={years.map(y => ({ value: y, label: String(y) }))} aria-label="Billing year" disabled={busy} />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center text-sm text-gray-500">
            No active leases yet. Add a tenant and lease to a property first.
          </div>
        ) : (
          <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 overflow-hidden">
            {rows.map(r => {
              const included = !r.skip && !excluded.has(r.lease.id);
              return (
                <label
                  key={r.lease.id}
                  className={`flex items-start gap-3 px-4 py-3 ${r.skip ? 'bg-surface-50 opacity-70' : 'cursor-pointer hover:bg-surface-50'}`}
                >
                  <input
                    type="checkbox"
                    className="rounded accent-brand-600 w-4 h-4 mt-1 flex-shrink-0"
                    checked={included}
                    disabled={!!r.skip || busy}
                    onChange={() => toggle(r.lease.id)}
                    aria-label={`Invoice ${r.property!.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.property!.name}</p>
                    <p className="text-xs text-gray-500 truncate">{r.tenant?.name || 'Tenant'}{!r.skip && ` · due ${formatDate(r.dueDate)}`}</p>
                    {r.skip ? (
                      <p className="text-xs text-gray-500 mt-0.5">{r.skip}</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.draft.rentIncluded ? 'Rent' : 'No rent due'}
                        {r.draft.recoveryCount > 0 && ` + ${r.draft.recoveryCount} cost recover${r.draft.recoveryCount === 1 ? 'y' : 'ies'}`}
                        {!r.draft.hasCostsForMonth && (
                          <span className="text-amber-700"> · no running costs captured for {formatMonthYear(month, year)}</span>
                        )}
                      </p>
                    )}
                  </div>
                  {!r.skip && <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(r.draft.totalAmount)}</span>}
                </label>
              );
            })}
          </div>
        )}

        {ready.some(r => !r.draft.hasCostsForMonth) && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p>Some properties have no running costs for this month, so their invoices are rent only. Capture the municipal or levy statement first if you recover utilities.</p>
          </div>
        )}

        <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" className="rounded accent-brand-600 w-4 h-4 mt-0.5 flex-shrink-0" checked={markSent} onChange={e => setMarkSent(e.target.checked)} disabled={busy} />
          <span>
            Mark as sent straight away
            <span className="block text-xs text-gray-400">Otherwise they are saved as drafts you can still edit.</span>
          </span>
        </label>

        <div className="flex items-center justify-between pt-3 border-t border-surface-200">
          <span className="text-sm text-gray-600 flex items-center gap-1.5"><FileText size={14} /> {chosen.length} invoice{chosen.length === 1 ? '' : 's'}</span>
          <span className="text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={busy} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={run} disabled={busy || chosen.length === 0} className="btn-primary flex-1 justify-center">
            <CheckCircle size={15} />
            {busy ? `Creating ${done + 1} of ${chosen.length}…` : `Create ${chosen.length} invoice${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

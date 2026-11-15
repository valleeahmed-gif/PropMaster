import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, Repeat, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Select, Toggle } from '../../components/UI';
import { StatementImport } from '../../components/StatementImport';
import { formatCurrency, formatMonthYear, MONTHS, errorMessage } from '../../utils';
import { UtilityBreakdown } from '../../types';

interface Props { propertyId: string; }

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
    if (!label.trim() || !(Number(amount) > 0)) return;
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
            className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 flex-shrink-0 text-xs" aria-label="Cancel edit">
            Cancel
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
                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-900 flex-shrink-0">
                  <Repeat size={11} /> Recurring
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900 flex-shrink-0 w-24 text-right">{formatCurrency(bd.amount)}</span>
          {/* Recoverable toggle */}
          <Toggle checked={bd.isRecoverable} onChange={v => onUpdate(bd.id, { isRecoverable: v })} label={undefined} />
          {/* Recurring toggle */}
          <button
            onClick={() => onUpdate(bd.id, { isRecurring: !bd.isRecurring })}
            title={bd.isRecurring ? 'Recurring monthly — click to disable' : 'Click to make recurring monthly'}
            aria-label={bd.isRecurring ? 'Recurring monthly — click to disable' : 'Make recurring monthly'}
            aria-pressed={bd.isRecurring}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              bd.isRecurring
                ? 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                : 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500'
            }`}
          >
            <Repeat size={15} />
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-surface-100 text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs">
            Edit
          </button>
          <button onClick={() => onDelete(bd.id)} aria-label={`Delete ${bd.label}`} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 flex-shrink-0">
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
    showToast,
  } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRecoverable, setNewRecoverable] = useState(true);
  const [newRecurring, setNewRecurring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);

  const cost = propertyCosts.find(c => c.propertyId === propertyId && c.month === month && c.year === year);
  const breakdowns = cost ? utilityBreakdowns.filter(b => b.propertyCostId === cost.id) : [];
  const totalRecoverable = breakdowns.filter(b => b.isRecoverable).reduce((s, b) => s + b.amount, 0);
  const totalNonRecoverable = breakdowns.filter(b => !b.isRecoverable).reduce((s, b) => s + b.amount, 0);
  const years = Array.from(new Set([now.getFullYear() - 3, now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, year])).sort();
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
    let added = 0;
    try {
      const c = await ensureCost();
      for (const item of recurringItems) {
        await addUtilityBreakdown({
          propertyCostId: c.id,
          label: item.label,
          amount: item.amount,
          isRecoverable: item.isRecoverable,
          isRecurring: true,
        });
        added++;
      }
      showToast(`${added} recurring item${added !== 1 ? 's' : ''} added`);
    } catch (err) {
      showToast(`Added ${added} of ${recurringItems.length} items — ${errorMessage(err)}`, 'error');
    } finally {
      setAutoPopulating(false);
    }
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
    if (!labelTrimmed || !newAmount || !(amountNum > 0)) {
      showToast('Please enter a label and a valid amount', 'error');
      return;
    }
    setAdding(true);
    try {
      const c = await ensureCost();
      await addUtilityBreakdown({
        propertyCostId: c.id,
        label: labelTrimmed,
        amount: Math.round(amountNum * 100) / 100,
        isRecoverable: newRecoverable,
        isRecurring: newRecurring,
      });
      setNewLabel('');
      setNewAmount('');
      setNewRecurring(false);
      showToast(`${labelTrimmed} added${newRecurring ? ' — will repeat monthly' : ''}`);
    } catch (err) {
      showToast(`Failed to save: ${errorMessage(err)}`, 'error');
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
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100">
        <Repeat size={16} className="text-blue-900 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-900 mb-0.5">Recurring costs</p>
          <p className="text-xs text-blue-900/80 leading-relaxed">
            Mark fixed monthly costs like <strong>levy</strong> or <strong>body corporate</strong> as recurring.
            When you open a new month, click <strong>Copy recurring items</strong> to auto-fill them — no re-entering needed. Variable costs like electricity should not be marked recurring.
          </p>
        </div>
      </div>

      {/* Auto-populate banner — shown when this month is empty but previous has recurring */}
      {canAutoPopulate && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 rounded-xl border border-green-200">
          <Sparkles size={18} className="text-green-700 flex-shrink-0" />
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
              <><Repeat size={13} /> Copy recurring items</>
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
            onUpdate={async (id, d) => {
              try { await updateUtilityBreakdown(id, d); }
              catch (err) { showToast(`Couldn't update item: ${errorMessage(err)}`, 'error'); }
            }}
            onDelete={async (id) => {
              try { await deleteUtilityBreakdown(id); showToast('Item removed'); }
              catch (err) { showToast(`Couldn't remove item: ${errorMessage(err)}`, 'error'); }
            }}
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
                <span className={`text-xs font-medium ${newRecurring ? 'text-blue-900' : 'text-gray-400'}`}>
                  Recurring monthly
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

      {/* Statement upload — read on the device, no AI service */}
      <StatementImport
        propertyId={propertyId}
        defaultMonth={month}
        defaultYear={year}
        onImported={(m, y) => { setMonth(m); setYear(y); }}
      />
    </div>
  );
}

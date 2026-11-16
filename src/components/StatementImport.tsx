import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, FileText, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FileUpload, Modal, Select, Spinner, Toggle } from './UI';
import { StatementExtract } from '../types';
import { errorMessage, formatCurrency, formatDate, formatMonthYear, MONTHS } from '../utils';
import type { ParsedStatement, ReadProgress } from '../lib/statements';

interface Props {
  propertyId: string;
  /** Month shown in the Running Costs tab — used when the statement has no readable period. */
  defaultMonth: number;
  defaultYear: number;
  /** Called after items were added, with the month they were added to. */
  onImported: (month: number, year: number) => void;
}

interface ReviewItem {
  label: string;
  amount: string;
  isRecoverable: boolean;
  /** Carries VAT (electricity, water, sewer, refuse). */
  vatable: boolean;
  selected: boolean;
  note?: string;
}

const CONFIDENCE: Record<ParsedStatement['confidence'], { cls: string; icon: React.ReactNode; title: string }> = {
  high:   { cls: 'bg-green-50 border-green-200 text-green-900', icon: <ShieldCheck size={16} className="text-green-600" />, title: 'Checked against the statement total' },
  medium: { cls: 'bg-brand-50 border-brand-100 text-brand-900', icon: <FileText size={16} className="text-brand-600" />, title: 'Read successfully — no statement total to check against' },
  low:    { cls: 'bg-amber-50 border-amber-200 text-amber-900', icon: <AlertTriangle size={16} className="text-amber-600" />, title: 'Please check these amounts carefully' },
};

const KIND_LABEL: Record<ParsedStatement['kind'], string> = {
  municipal: 'Municipal account',
  levy: 'Levy statement',
  unknown: 'Statement',
};

function progressText(p: ReadProgress | null): string {
  if (!p || p.stage === 'opening') return 'Opening file…';
  if (p.stage === 'reading') return 'Reading statement…';
  const pct = Math.round((p.fraction ?? 0) * 100);
  return `Scanned document — reading the image${pct > 0 ? ` (${pct}%)` : '…'}`;
}

export function StatementImport({ propertyId, defaultMonth, defaultYear, onImported }: Props) {
  const {
    propertyCosts, utilityBreakdowns, statementUploads,
    addPropertyCost, addUtilityBreakdown, addStatementUpload, updateStatementUpload, showToast,
  } = useApp();

  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [locked, setLocked] = useState<{ file: File; incorrect: boolean } | null>(null);
  const [password, setPassword] = useState('');

  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [saving, setSaving] = useState(false);
  const [vatOn, setVatOn] = useState(false);

  const thisYear = new Date().getFullYear();
  const years = Array.from(new Set([thisYear - 3, thisYear - 2, thisYear - 1, thisYear, thisYear + 1, year])).sort();

  const readFile = async (file: File, pdfPassword?: string) => {
    setError(null);
    setBusy(true);
    setProgress({ stage: 'opening' });
    setFileName(file.name);
    try {
      // Loaded on demand: the reader (pdf.js, OCR) is only needed on this screen.
      const { readStatement, PdfPasswordError } = await import('../lib/statements');
      let result: ParsedStatement;
      try {
        result = await readStatement(file, { password: pdfPassword, onProgress: setProgress });
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          setLocked({ file, incorrect: err.incorrect });
          return;
        }
        throw err;
      }
      setLocked(null);
      setPassword('');
      if (result.items.length === 0) {
        setError(
          result.method === 'ocr'
            ? "We couldn't read any charges from this scan. Try a clearer photo or the original PDF, or add the items manually above."
            : "We couldn't find any charges on this document. Check it is a municipal account or levy statement, or add the items manually above.",
        );
        return;
      }
      const m = result.period?.month ?? defaultMonth;
      const y = result.period?.year ?? defaultYear;
      setMonth(m);
      setYear(y);
      setItems(result.items.map(i => ({
        label: i.label,
        amount: i.amount.toFixed(2),
        isRecoverable: i.isRecoverable,
        vatable: i.vatable,
        selected: true,
        note: [
          i.consumption ? `${i.consumption.value.toLocaleString('en-ZA')} ${i.consumption.unit}` : null,
          i.readingType === 'estimated' ? 'estimated reading' : i.readingType === 'actual' ? 'actual reading' : null,
        ].filter(Boolean).join(' · ') || undefined,
      })));
      setVatOn(result.vatAdded);
      setParsed(result);
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong reading this file. Please try again.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const closeReview = () => { if (!saving) { setParsed(null); setItems([]); } };

  // What is already captured for the chosen month, to warn about double entry.
  const targetCost = propertyCosts.find(c => c.propertyId === propertyId && c.month === month && c.year === year);
  const existing = targetCost ? utilityBreakdowns.filter(b => b.propertyCostId === targetCost.id) : [];
  const existingLabels = new Set(existing.map(b => b.label.toLowerCase()));
  const clashes = items.filter(i => i.selected && existingLabels.has(i.label.trim().toLowerCase()));

  const alreadyImported = parsed?.accountNumber
    ? statementUploads.find(u => {
        const e = u.extractedData;
        return u.propertyId === propertyId && !!u.propertyCostId && !!e && !Array.isArray(e)
          && e.accountNumber === parsed.accountNumber
          && e.period?.month === parsed.period?.month && e.period?.year === parsed.period?.year;
      })
    : undefined;

  const selected = items.filter(i => i.selected);
  const valid = selected.length > 0 && selected.every(i => i.label.trim() && Number(i.amount) > 0);
  const sumOf = (list: ReviewItem[]) => list.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const confirm = async () => {
    if (!parsed || !valid || saving) return;
    setSaving(true);
    let added = 0;
    try {
      const cost = targetCost ?? await addPropertyCost({ propertyId, month, year });
      for (const item of selected) {
        await addUtilityBreakdown({
          propertyCostId: cost.id,
          label: item.label.trim(),
          amount: Math.round(Number(item.amount) * 100) / 100,
          isRecoverable: item.isRecoverable,
          isRecurring: false,
        });
        added++;
      }
      // Keep a record of what was imported (not the file itself — it never leaves the device).
      try {
        const safeName = fileName.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'statement';
        const extract: StatementExtract = {
          kind: parsed.kind, issuer: parsed.issuer, accountNumber: parsed.accountNumber,
          statementDate: parsed.statementDate, period: { month, year },
          method: parsed.method, confidence: parsed.confidence, reconciled: parsed.reconciled,
          items: selected.map(i => ({ label: i.label.trim(), amount: Math.round(Number(i.amount) * 100) / 100 })),
        };
        const upload = await addStatementUpload({ propertyId, filePath: `device-only/${Date.now()}-${safeName}`, fileName: safeName });
        await updateStatementUpload(upload.id, { extractionStatus: 'complete', extractedData: extract, propertyCostId: cost.id });
      } catch (err) {
        console.error('Could not record statement import:', err);
      }
      showToast(`${added} item${added === 1 ? '' : 's'} added to ${formatMonthYear(month, year)}`);
      setParsed(null);
      setItems([]);
      onImported(month, year);
    } catch (err) {
      // Drop the ones that made it in so a retry doesn't duplicate them.
      setItems(prev => {
        let skip = added;
        return prev.filter(i => !(i.selected && skip-- > 0));
      });
      showToast(`Added ${added} of ${selected.length} items — ${errorMessage(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Add or remove VAT on the services that carry it, keeping any edits.
  const toggleVat = (on: boolean) => {
    const ratio = parsed?.vatRatio || 1.15;
    setVatOn(on);
    setItems(prev => prev.map(i => {
      if (!i.vatable) return i;
      const n = Number(i.amount);
      if (!Number.isFinite(n)) return i;
      return { ...i, amount: (Math.round((on ? n * ratio : n / ratio) * 100) / 100).toFixed(2) };
    }));
  };
  const showVatSwitch = !!parsed && parsed.kind !== 'levy' && items.some(i => i.vatable);
  const statementTotal = parsed?.totals.currentCharges;

  const update = (i: number, patch: Partial<ReviewItem>) =>
    setItems(prev => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const conf = parsed ? CONFIDENCE[parsed.confidence] : null;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-1 gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Upload municipal or levy statement</h3>
        <span className="badge-green text-xs flex-shrink-0">Read on your device</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        City of Johannesburg and other municipal accounts, and body corporate / HOA levy statements — as a PDF, scan or photo.
        PropMaster reads the charges right here in your browser and checks them against the statement total. The file is never uploaded.
      </p>

      {busy ? (
        <div className="flex flex-col items-center gap-4 py-10 border-2 border-dashed border-brand-200 rounded-xl bg-brand-50" role="status">
          <Spinner size={36} />
          <div className="text-center px-4">
            <p className="text-sm font-medium text-brand-900">{progressText(progress)}</p>
            <p className="text-xs text-brand-600 mt-1 break-all">{fileName}</p>
          </div>
        </div>
      ) : locked ? (
        <div className="space-y-3 p-4 border border-surface-200 rounded-xl bg-surface-50">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">This PDF is password protected</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enter the password the sender gave you (often your ID number or account number). It is only used here to open the file.
              </p>
            </div>
          </div>
          <input
            className="input"
            type="password"
            placeholder="PDF password"
            value={password}
            autoFocus
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && password) readFile(locked.file, password); }}
            aria-label="PDF password"
          />
          {locked.incorrect && <p className="text-xs text-red-600">That password didn't open the file. Please try again.</p>}
          <div className="flex gap-2">
            <button onClick={() => { setLocked(null); setPassword(''); }} className="btn-secondary text-xs flex-1 justify-center">Cancel</button>
            <button onClick={() => readFile(locked.file, password)} disabled={!password} className="btn-primary text-xs flex-1 justify-center">Unlock &amp; read</button>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl" role="alert">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Couldn't read this statement</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="btn-secondary text-xs gap-1.5 w-full justify-center">
            <RotateCcw size={13} /> Try another file
          </button>
        </div>
      ) : (
        <FileUpload
          onFile={f => readFile(f)}
          accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
          label="Upload statement (PDF or photo)"
        />
      )}

      <Modal open={!!parsed} onClose={closeReview} title="Review statement" size="lg">
        {parsed && conf && (
          <div className="p-6 space-y-4">
            {/* What was read */}
            <div className="flex items-start gap-3 p-3.5 bg-surface-50 rounded-xl border border-surface-200">
              <FileText size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs text-gray-600 space-y-0.5">
                <p className="font-semibold text-gray-900 text-sm">{parsed.issuer || KIND_LABEL[parsed.kind]}</p>
                <p className="break-all">{fileName}</p>
                <p>
                  {parsed.issuer ? `${KIND_LABEL[parsed.kind]}` : null}
                  {parsed.accountNumber ? `${parsed.issuer ? ' · ' : ''}Account ${parsed.accountNumber}` : null}
                  {parsed.statementDate ? ` · Dated ${formatDate(parsed.statementDate)}` : null}
                  {parsed.dueDate ? ` · Due ${formatDate(parsed.dueDate)}` : null}
                </p>
              </div>
            </div>

            {/* Confidence */}
            <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${conf.cls}`}>
              <span className="flex-shrink-0 mt-0.5">{conf.icon}</span>
              <div className="text-xs space-y-1 min-w-0">
                <p className="font-semibold text-sm">{conf.title}</p>
                {parsed.reconciled === true && parsed.totals.currentCharges !== undefined && (
                  <p>The items add up to the statement's current charges of {formatCurrency(parsed.totals.currentCharges)}.</p>
                )}
                {parsed.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>

            {alreadyImported && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 text-xs" role="alert">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">This looks like a statement you already imported</span>
                  {' '}(same account and month, on {formatDate(alreadyImported.uploadedAt)}). Adding it again will double up the costs.
                </p>
              </div>
            )}

            {/* Month */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add to month</p>
              <div className="grid grid-cols-2 gap-3">
                <Select value={month} onChange={e => setMonth(Number(e.target.value))} options={MONTHS} aria-label="Month" />
                <Select value={year} onChange={e => setYear(Number(e.target.value))} options={years.map(y => ({ value: y, label: String(y) }))} aria-label="Year" />
              </div>
              {clashes.length > 0 && (
                <p className="text-xs text-amber-700 mt-2">
                  {formatMonthYear(month, year)} already has {clashes.map(c => c.label).join(', ')}. Untick {clashes.length === 1 ? 'it' : 'them'} below unless you want a second line.
                </p>
              )}
            </div>

            {showVatSwitch && (
              <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-surface-200 bg-surface-50">
                <div className="text-xs text-ink-600">
                  <p className="text-sm font-semibold text-ink-900">Add 15% VAT to utilities</p>
                  <p className="mt-0.5">
                    For statements that list electricity, water, sewer and refuse excluding VAT (City of Johannesburg does).
                    Rates and levies are never changed.
                  </p>
                </div>
                <Toggle checked={vatOn} onChange={toggleVat} label={undefined} />
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Charges found ({items.length}) — tick to include, edit if needed
              </p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border transition-all ${item.selected ? 'border-brand-200 bg-brand-50' : 'border-surface-200 bg-white opacity-60'}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={e => update(i, { selected: e.target.checked })}
                        className="rounded accent-brand-600 w-4 h-4 flex-shrink-0"
                        aria-label={`Include ${item.label}`}
                      />
                      <input
                        className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 font-medium outline-none focus:underline"
                        value={item.label}
                        onChange={e => update(i, { label: e.target.value })}
                        aria-label="Description"
                      />
                      <button
                        type="button"
                        onClick={() => update(i, { isRecoverable: !item.isRecoverable })}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium select-none transition-colors flex-shrink-0 ${
                          item.isRecoverable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                        title="Click to change who pays"
                      >
                        {item.isRecoverable ? 'Tenant pays' : 'Owner pays'}
                      </button>
                      <div className="relative w-28 flex-shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R</span>
                        <input
                          className="w-full bg-white/70 rounded-lg border border-surface-200 text-sm font-bold text-gray-900 text-right py-1 pr-2 pl-5 outline-none focus:border-brand-400"
                          type="number" inputMode="decimal" step="0.01" min="0"
                          value={item.amount}
                          onChange={e => update(i, { amount: e.target.value })}
                          aria-label={`${item.label} amount`}
                        />
                      </div>
                    </div>
                    {item.note && <p className="text-xs text-gray-500 mt-1 ml-6 sm:ml-7">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {selected.length > 0 && (
              <div className="pt-2 border-t border-surface-200 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tenant pays</span>
                  <span className="font-medium text-green-700">{formatCurrency(sumOf(selected.filter(i => i.isRecoverable)))}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Owner pays</span>
                  <span className="font-medium text-gray-700">{formatCurrency(sumOf(selected.filter(i => !i.isRecoverable)))}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1 border-t border-surface-100">
                  <span>Total adding</span>
                  <span>{formatCurrency(sumOf(selected))}</span>
                </div>
                {statementTotal !== undefined && (
                  Math.abs(sumOf(items) - statementTotal) <= 1 ? (
                    <p className="text-xs text-green-700 font-medium text-right">✓ Matches the statement's current charges</p>
                  ) : (
                    <p className="text-xs text-amber-700 font-medium text-right">
                      Statement's current charges: {formatCurrency(statementTotal)} (difference {formatCurrency(sumOf(items) - statementTotal)})
                    </p>
                  )
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={closeReview} disabled={saving} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={confirm} disabled={saving || !valid} className="btn-primary flex-1 justify-center">
                <CheckCircle size={15} /> {saving ? 'Adding…' : `Add ${selected.length} item${selected.length === 1 ? '' : 's'} to ${formatMonthYear(month, year)}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

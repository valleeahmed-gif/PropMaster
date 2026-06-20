import React, { useState, useMemo } from 'react';
import { BarChart2, FileText, AlertCircle, Download, TrendingUp, TrendingDown, Building2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, Tabs, StatusBadge } from '../components/UI';
import { formatCurrency, formatDate, formatMonthYear, MONTHS } from '../utils';

// ── CSV export helper ──────────────────────────────────────
function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Summary Stat ───────────────────────────────────────────
function ReportStat({ label, value, sub, positive, neutral }: {
  label: string; value: string; sub?: string; positive?: boolean; neutral?: boolean;
}) {
  const color = neutral ? 'text-gray-900' : positive ? 'text-green-700' : 'text-red-600';
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── P&L Report ─────────────────────────────────────────────

// ── P&L Report ─────────────────────────────────────────────
function ProfitLossReport() {
  const { properties, invoices, payments, propertyCosts, utilityBreakdowns, user } = useApp();

  const now = new Date();
  const [fromMonth, setFromMonth] = useState(1);
  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [toMonth, setToMonth] = useState(now.getMonth() + 1);
  const [toYear, setToYear] = useState(now.getFullYear());
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const myProperties = properties.filter(p => p.ownerId === user?.id);
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  // ── Auto-correct: if from > to, snap to to the same period ─
  const handleFromMonth = (m: number) => {
    setFromMonth(m);
    const fromTs = new Date(fromYear, m - 1, 1).getTime();
    const toTs   = new Date(toYear, toMonth - 1, 1).getTime();
    if (fromTs > toTs) { setToMonth(m); setToYear(fromYear); }
  };
  const handleFromYear = (y: number) => {
    setFromYear(y);
    const fromTs = new Date(y, fromMonth - 1, 1).getTime();
    const toTs   = new Date(toYear, toMonth - 1, 1).getTime();
    if (fromTs > toTs) { setToMonth(fromMonth); setToYear(y); }
  };

  const inRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const from = new Date(fromYear, fromMonth - 1, 1);
    const to = new Date(toYear, toMonth, 0);
    return d >= from && d <= to;
  };

  // Check if an invoice month/year falls in range
  const invoiceInRange = (month: number, year: number) => {
    const d = new Date(year, month - 1, 1);
    const from = new Date(fromYear, fromMonth - 1, 1);
    const to = new Date(toYear, toMonth, 0);
    return d >= from && d <= to;
  };

  const pnlData = useMemo(() => {
    const props = selectedProperty === 'all'
      ? myProperties
      : myProperties.filter(p => p.id === selectedProperty);

    return props.map(prop => {
      // ── All verified payments received ────────────────────
      const propPayments = payments.filter(p =>
        p.propertyId === prop.id &&
        p.status === 'verified' &&
        inRange(p.paymentDate)
      );
      const totalCollected = propPayments.reduce((s, p) => s + p.amount, 0);

      // ── Running costs for this period ─────────────────────
      const propCosts = propertyCosts.filter(c => {
        if (c.propertyId !== prop.id) return false;
        const d = new Date(c.year, c.month - 1, 1);
        const from = new Date(fromYear, fromMonth - 1, 1);
        const to = new Date(toYear, toMonth, 0);
        return d >= from && d <= to;
      });

      const allBreakdowns = propCosts.flatMap(c =>
        utilityBreakdowns.filter(b => b.propertyCostId === c.id)
      );

      // Recoverable = utilities collected from tenant and paid to COJ (pass-through)
      const recoverableCosts = allBreakdowns
        .filter(b => b.isRecoverable)
        .reduce((s, b) => s + b.amount, 0);

      // Non-recoverable from Running Costs = levy, rates etc
      const nonRecoverableFromCosts = allBreakdowns
        .filter(b => !b.isRecoverable)
        .reduce((s, b) => s + b.amount, 0);

      // ── Custom invoice line items not in Running Costs ────
      // When landlord adds a custom line (e.g. "Garden service R500") directly
      // to an invoice, it doesn't exist in property_costs. We detect these by
      // looking at invoice lines that are NOT rent and NOT a known recovery item,
      // so they represent real costs the landlord incurred.
      const knownRecoveryLabels = new Set(
        allBreakdowns.filter(b => b.isRecoverable).map(b => `${b.label} recovery`.toLowerCase())
      );

      const propInvoices = invoices.filter(i =>
        i.propertyId === prop.id &&
        i.status !== 'draft' &&
        invoiceInRange(i.month, i.year)
      );

      // Custom lines = non-rent lines that don't match a known running cost recovery
      const customInvoiceLineCosts = propInvoices.reduce((sum, inv) => {
        return sum + inv.lineItems
          .filter(li => {
            const desc = li.description.toLowerCase();
            const isRent = desc.includes('rent');
            const isKnownRecovery = knownRecoveryLabels.has(desc);
            return !isRent && !isKnownRecovery;
          })
          .reduce((s, li) => s + li.amount, 0);
      }, 0);

      const nonRecoverableCosts = nonRecoverableFromCosts + customInvoiceLineCosts;

      // ── Net profit ────────────────────────────────────────
      // totalCollected = rent + recoverable utilities (from tenant)
      // recoverableCosts = utilities paid to COJ (pass-through)
      // nonRecoverableCosts = levy/rates + custom invoice costs you absorbed
      // netProfit = totalCollected - recoverableCosts - nonRecoverableCosts
      const netProfit = totalCollected - recoverableCosts - nonRecoverableCosts;
      const rentIncome = totalCollected - recoverableCosts;

      return {
        property: prop,
        totalCollected,
        recoverableCosts,
        nonRecoverableFromCosts,
        customInvoiceLineCosts,
        nonRecoverableCosts,
        rentIncome,
        netProfit,
        paymentCount: propPayments.length,
        payments: propPayments,
      };
    });
  }, [selectedProperty, fromMonth, fromYear, toMonth, toYear, payments, propertyCosts, utilityBreakdowns, invoices]);

  const totals = useMemo(() => ({
    collected:      pnlData.reduce((s, r) => s + r.totalCollected, 0),
    passthrough:    pnlData.reduce((s, r) => s + r.recoverableCosts, 0),
    nonRecoverable: pnlData.reduce((s, r) => s + r.nonRecoverableCosts, 0),
    net:            pnlData.reduce((s, r) => s + r.netProfit, 0),
  }), [pnlData]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const headers = [
      'Property',
      'Total Collected (ZAR)',
      'Utility Pass-through (ZAR)',
      'Non-recoverable Costs (ZAR)',
      'Net Profit (ZAR)',
      'Payments',
    ];
    const rows = pnlData.map(r => [
      r.property.name,
      r.totalCollected.toFixed(2),
      r.recoverableCosts.toFixed(2),
      r.nonRecoverableCosts.toFixed(2),
      r.netProfit.toFixed(2),
      r.paymentCount,
    ]);
    rows.push([
      'TOTAL',
      totals.collected.toFixed(2),
      totals.passthrough.toFixed(2),
      totals.nonRecoverable.toFixed(2),
      totals.net.toFixed(2),
      '',
    ]);
    exportCSV(`propmaster-pnl-${fromMonth}-${fromYear}-to-${toMonth}-${toYear}.csv`, headers, rows);
  };

  return (
    <div className="space-y-5">

      {/* Filters */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filters</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label">From month</label>
            <select className="input" value={fromMonth} onChange={e => handleFromMonth(Number(e.target.value))}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From year</label>
            <select className="input" value={fromYear} onChange={e => handleFromYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To month</label>
            <select className="input" value={toMonth} onChange={e => setToMonth(Number(e.target.value))}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To year</label>
            <select className="input" value={toYear} onChange={e => setToYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Property</label>
            <select className="input" value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
              <option value="all">All properties</option>
              {myProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* How profit is calculated — explanation */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">i</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-900 mb-0.5">How net profit is calculated</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Utility costs you recover from your tenant (water, electricity, refuse) are <strong>pass-through money</strong> — you collect them and pay them straight to COJ or the municipality. They are not your income. Net profit = rent collected − utility pass-through to COJ − your own non-recoverable costs (levy, rates).
          </p>
        </div>
      </div>

      {/* Summary stats — 4 cards showing the full money flow */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total collected</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.collected)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rent + utilities from tenant</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-300">
          <p className="text-xs text-gray-500 mb-1">Utility pass-through</p>
          <p className="text-xl font-bold text-amber-700">− {formatCurrency(totals.passthrough)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Paid to COJ / municipality</p>
        </div>
        <div className="card p-4 border-l-4 border-red-300">
          <p className="text-xs text-gray-500 mb-1">Your own costs</p>
          <p className="text-xl font-bold text-red-600">− {formatCurrency(totals.nonRecoverable)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Levy, rates, insurance</p>
        </div>
        <div className={`card p-4 border-l-4 ${totals.net >= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <p className="text-xs text-gray-500 mb-1">Net profit</p>
          <p className={`text-xl font-bold ${totals.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(totals.net)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{totals.net >= 0 ? 'What you keep' : 'Running at a loss'}</p>
        </div>
      </div>

      {/* Property table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-gray-900">
            P&amp;L by property — {formatMonthYear(fromMonth, fromYear)} to {formatMonthYear(toMonth, toYear)}
          </h3>
          <button onClick={handleExport} className="btn-secondary text-xs gap-1.5">
            <Download size={13} /> Export CSV
          </button>
        </div>

        {pnlData.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">No data for selected range</p>
        ) : (
          <div>
            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-2.5 bg-surface-50 border-b border-surface-100">
              {['Property', 'Collected', '− Utilities to COJ', '− Own costs', 'Net profit'].map(h => (
                <p key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {pnlData.map(row => {
              const expanded = expandedRows.has(row.property.id);
              const margin = row.totalCollected > 0
                ? ((row.netProfit / row.totalCollected) * 100).toFixed(1)
                : '—';

              return (
                <div key={row.property.id} className="border-b border-surface-100 last:border-0">
                  <div
                    className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-5 py-4 cursor-pointer hover:bg-surface-50 transition-colors"
                    onClick={() => toggleRow(row.property.id)}
                  >
                    {/* Property name */}
                    <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                      <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                        <Building2 size={13} className="text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight truncate">{row.property.name}</p>
                        <p className="text-xs text-gray-400">{row.paymentCount} payments</p>
                      </div>
                      {expanded
                        ? <ChevronUp size={14} className="text-gray-400 ml-auto sm:hidden flex-shrink-0" />
                        : <ChevronDown size={14} className="text-gray-400 ml-auto sm:hidden flex-shrink-0" />
                      }
                    </div>

                    {/* Total collected */}
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.totalCollected)}</p>
                    </div>

                    {/* Utility pass-through */}
                    <div className="hidden sm:block">
                      {row.recoverableCosts > 0 ? (
                        <>
                          <p className="text-sm font-semibold text-amber-700">− {formatCurrency(row.recoverableCosts)}</p>
                          <p className="text-xs text-gray-400">paid to COJ</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-300">—</p>
                      )}
                    </div>

                    {/* Own costs */}
                    <div className="hidden sm:block">
                      {row.nonRecoverableCosts > 0 ? (
                        <>
                          <p className="text-sm font-semibold text-red-600">− {formatCurrency(row.nonRecoverableCosts)}</p>
                          <p className="text-xs text-gray-400">levy / rates</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-300">—</p>
                      )}
                    </div>

                    {/* Net profit */}
                    <div className="hidden sm:block">
                      <p className={`text-sm font-bold ${row.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {formatCurrency(row.netProfit)}
                      </p>
                      {margin !== '—' && (
                        <p className="text-xs text-gray-400">{margin}% of collected</p>
                      )}
                    </div>
                  </div>

                  {/* Mobile + expanded breakdown */}
                  {expanded && (
                    <div className="px-5 pb-4 bg-surface-50 border-t border-surface-100 space-y-3">

                      {/* Mobile summary */}
                      <div className="grid grid-cols-2 gap-3 pt-3 sm:hidden">
                        <div><p className="text-xs text-gray-500">Collected</p><p className="text-sm font-bold text-gray-900">{formatCurrency(row.totalCollected)}</p></div>
                        <div><p className="text-xs text-gray-500">Net profit</p><p className={`text-sm font-bold ${row.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(row.netProfit)}</p></div>
                      </div>

                      {/* Money flow breakdown */}
                      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
                        <div className="px-4 py-2 border-b border-surface-100 bg-surface-50">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Money flow</p>
                        </div>
                        <div className="divide-y divide-surface-100">
                          <div className="flex justify-between items-center px-4 py-2.5">
                            <span className="text-xs text-gray-600">Total collected from tenant</span>
                            <span className="text-xs font-semibold text-gray-900">{formatCurrency(row.totalCollected)}</span>
                          </div>
                          {row.recoverableCosts > 0 && (
                            <div className="flex justify-between items-center px-4 py-2.5 bg-amber-50">
                              <div>
                                <span className="text-xs text-amber-800">Less: utility pass-through to COJ</span>
                                <p className="text-xs text-amber-600">Water, electricity, refuse — not yours to keep</p>
                              </div>
                              <span className="text-xs font-semibold text-amber-700 flex-shrink-0 ml-3">− {formatCurrency(row.recoverableCosts)}</span>
                            </div>
                          )}
                          {row.nonRecoverableFromCosts > 0 && (
                            <div className="flex justify-between items-center px-4 py-2.5 bg-red-50">
                              <div>
                                <span className="text-xs text-red-800">Less: your own costs (Running Costs)</span>
                                <p className="text-xs text-red-600">Levy, rates, insurance</p>
                              </div>
                              <span className="text-xs font-semibold text-red-700 flex-shrink-0 ml-3">− {formatCurrency(row.nonRecoverableFromCosts)}</span>
                            </div>
                          )}
                          {row.customInvoiceLineCosts > 0 && (
                            <div className="flex justify-between items-center px-4 py-2.5 bg-red-50">
                              <div>
                                <span className="text-xs text-red-800">Less: custom invoice costs</span>
                                <p className="text-xs text-red-600">Items added directly to invoices (garden service, repairs, etc.)</p>
                              </div>
                              <span className="text-xs font-semibold text-red-700 flex-shrink-0 ml-3">− {formatCurrency(row.customInvoiceLineCosts)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-t-2 border-gray-200">
                            <span className="text-sm font-bold text-gray-900">Net profit</span>
                            <span className={`text-sm font-bold ${row.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {formatCurrency(row.netProfit)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Individual payments */}
                      {row.payments.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payments received</p>
                          <div className="space-y-1.5">
                            {row.payments.map(p => (
                              <div key={p.id} className="flex justify-between text-xs text-gray-600">
                                <span>{formatDate(p.paymentDate)} · {p.method.replace('_', ' ').toUpperCase()}</span>
                                <span className="font-medium">{formatCurrency(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {row.payments.length === 0 && (
                        <p className="text-xs text-gray-400">No payments in this period</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Portfolio totals row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-5 py-4 bg-gray-50 border-t-2 border-gray-200">
              <p className="text-sm font-bold text-gray-900 col-span-2 sm:col-span-1">Portfolio total</p>
              <p className="hidden sm:block text-sm font-bold text-gray-900">{formatCurrency(totals.collected)}</p>
              <p className="hidden sm:block text-sm font-bold text-amber-700">− {formatCurrency(totals.passthrough)}</p>
              <p className="hidden sm:block text-sm font-bold text-red-600">− {formatCurrency(totals.nonRecoverable)}</p>
              <p className={`hidden sm:block text-sm font-bold ${totals.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(totals.net)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rent Roll Report ───────────────────────────────────────
function RentRollReport() {
  const { properties, leases, tenants, invoices, payments, user } = useApp();

  const myProperties = properties.filter(p => p.ownerId === user?.id);
  const activeLeases = leases.filter(l => l.ownerId === user?.id && l.status === 'active');
  const endedLeases = leases.filter(l => l.ownerId === user?.id && l.status === 'ended');

  const rentRollRows = myProperties.map(prop => {
    const lease = activeLeases.find(l => l.propertyId === prop.id);
    const tenant = lease ? tenants.find(t => t.id === lease.tenantId) : null;

    // Last payment
    const propPayments = [...payments.filter(p => p.propertyId === prop.id && p.status === 'verified')]
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    const lastPayment = propPayments[0];

    // Outstanding amount
    const outstanding = invoices
      .filter(i => i.propertyId === prop.id && (i.status === 'sent' || i.status === 'overdue'))
      .reduce((s, i) => s + i.totalAmount, 0);

    // Days until lease end
    let daysToExpiry: number | null = null;
    if (lease?.endDate) {
      daysToExpiry = Math.ceil((new Date(lease.endDate).getTime() - Date.now()) / 86400000);
    }

    return { prop, lease, tenant, lastPayment, outstanding, daysToExpiry };
  });

  const totalMonthlyRent = activeLeases.reduce((s, l) => s + l.rentAmount, 0);
  const totalDeposits = activeLeases.reduce((s, l) => s + l.depositPaid, 0);
  const totalOutstanding = rentRollRows.reduce((s, r) => s + r.outstanding, 0);
  const vacantCount = myProperties.filter(p => !activeLeases.find(l => l.propertyId === p.id)).length;
  const occupancyRate = myProperties.length > 0
    ? Math.round((activeLeases.length / myProperties.length) * 100)
    : 0;

  const handleExport = () => {
    const headers = ['Property', 'City', 'Province', 'Tenant', 'Email', 'Phone', 'Rent (ZAR)', 'Deposit (ZAR)', 'Lease Start', 'Lease End', 'Outstanding (ZAR)', 'Status'];
    const rows = rentRollRows.map(r => [
      r.prop.name,
      r.prop.city,
      r.prop.province,
      r.tenant?.name || '—',
      r.tenant?.email || '—',
      r.tenant?.phone || '—',
      r.lease?.rentAmount.toFixed(2) || '0.00',
      r.lease?.depositPaid.toFixed(2) || '0.00',
      r.lease ? formatDate(r.lease.startDate) : '—',
      r.lease?.endDate ? formatDate(r.lease.endDate) : 'Open-ended',
      r.outstanding.toFixed(2),
      r.lease ? 'Tenanted' : 'Vacant',
    ]);
    exportCSV(`propmaster-rent-roll-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <ReportStat label="Occupancy rate" value={`${occupancyRate}%`} sub={`${activeLeases.length} of ${myProperties.length} properties`} positive={occupancyRate >= 80} neutral={occupancyRate === 0} />
        <ReportStat label="Monthly rent roll" value={formatCurrency(totalMonthlyRent)} sub="Active leases" positive neutral={totalMonthlyRent === 0} />
        <ReportStat label="Deposits held" value={formatCurrency(totalDeposits)} sub={`${activeLeases.length} leases`} positive neutral />
        <ReportStat label="Total outstanding" value={formatCurrency(totalOutstanding)} sub="Sent + overdue invoices" positive={totalOutstanding === 0} neutral={totalOutstanding === 0} />
      </div>

      {/* Rent roll table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-gray-900">Active leases — Rent roll</h3>
          <button onClick={handleExport} className="btn-secondary text-xs gap-1.5">
            <Download size={13} /> Export CSV
          </button>
        </div>

        {rentRollRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">No properties found</p>
        ) : (
          <div className="overflow-x-auto -mx-0">
            <table className="w-full" style={{minWidth:"700px"}}>
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  {['Property', 'Tenant', 'Rent / mo', 'Deposit', 'Lease period', 'Last payment', 'Outstanding', ''].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentRollRows.map(({ prop, lease, tenant, lastPayment, outstanding, daysToExpiry }) => (
                  <tr key={prop.id} className="table-row">
                    <td className="table-cell">
                      <p className="font-medium text-gray-900 text-sm">{prop.name}</p>
                      <p className="text-xs text-gray-400">{prop.city}</p>
                    </td>
                    <td className="table-cell">
                      {tenant ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-400">{tenant.email}</p>
                        </>
                      ) : (
                        <span className="badge-amber">Vacant</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <p className="text-sm font-semibold text-gray-900">{lease ? formatCurrency(lease.rentAmount) : '—'}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-700">{lease ? formatCurrency(lease.depositPaid) : '—'}</p>
                    </td>
                    <td className="table-cell">
                      {lease ? (
                        <div>
                          <p className="text-xs text-gray-700">{formatDate(lease.startDate)}</p>
                          <p className="text-xs text-gray-400">
                            → {lease.endDate ? formatDate(lease.endDate) : 'Open-ended'}
                          </p>
                          {daysToExpiry !== null && daysToExpiry <= 60 && (
                            <span className={`text-xs font-medium ${daysToExpiry <= 30 ? 'text-red-600' : 'text-amber-600'}`}>
                              {daysToExpiry <= 0 ? 'Expired' : `${daysToExpiry}d left`}
                            </span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="table-cell">
                      {lastPayment ? (
                        <div>
                          <p className="text-xs text-gray-700">{formatDate(lastPayment.paymentDate)}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(lastPayment.amount)}</p>
                        </div>
                      ) : <span className="text-xs text-gray-400">None</span>}
                    </td>
                    <td className="table-cell">
                      {outstanding > 0 ? (
                        <span className="text-sm font-semibold text-red-600">{formatCurrency(outstanding)}</span>
                      ) : (
                        <span className="badge-green">Clear</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={lease ? 'active' : 'draft'} label={lease ? 'Tenanted' : 'Vacant'} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="table-cell font-bold text-gray-900" colSpan={2}>Totals</td>
                  <td className="table-cell font-bold text-green-700">{formatCurrency(totalMonthlyRent)}</td>
                  <td className="table-cell font-bold text-gray-700">{formatCurrency(totalDeposits)}</td>
                  <td className="table-cell text-xs text-gray-500">{activeLeases.length} active leases</td>
                  <td className="table-cell"></td>
                  <td className="table-cell font-bold text-red-600">{totalOutstanding > 0 ? formatCurrency(totalOutstanding) : '—'}</td>
                  <td className="table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Ended leases */}
      {endedLeases.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100">
            <h3 className="text-sm font-semibold text-gray-900">Ended leases ({endedLeases.length})</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {endedLeases.map(l => {
              const prop = properties.find(p => p.id === l.propertyId);
              const tenant = tenants.find(t => t.id === l.tenantId);
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3.5 text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{prop?.name}</p>
                    <p className="text-xs text-gray-400">{tenant?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{formatDate(l.startDate)} → {l.endDate ? formatDate(l.endDate) : '—'}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(l.rentAmount)}/mo</p>
                  </div>
                  <StatusBadge status="ended" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outstanding Invoices Report ────────────────────────────
function OutstandingReport() {
  const { invoices, properties, leases, tenants, updateInvoice, showToast, user } = useApp();

  const myInvoices = invoices.filter(i => i.ownerId === user?.id);
  const outstanding = [...myInvoices.filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'draft')]
    .sort((a, b) => {
      const order = { overdue: 0, sent: 1, draft: 2 };
      return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
    });

  const totals = {
    overdue: outstanding.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0),
    sent: outstanding.filter(i => i.status === 'sent').reduce((s, i) => s + i.totalAmount, 0),
    draft: outstanding.filter(i => i.status === 'draft').reduce((s, i) => s + i.totalAmount, 0),
    total: outstanding.reduce((s, i) => s + i.totalAmount, 0),
  };

  const daysOverdue = (dueDateStr: string) => {
    const days = Math.floor((Date.now() - new Date(dueDateStr).getTime()) / 86400000);
    return days > 0 ? days : 0;
  };

  const handleExport = () => {
    const headers = ['Invoice #', 'Property', 'Tenant', 'Month', 'Due Date', 'Amount (ZAR)', 'Status', 'Days Overdue'];
    const rows = outstanding.map(inv => {
      const prop = properties.find(p => p.id === inv.propertyId);
      const lease = leases.find(l => l.id === inv.leaseId);
      const tenant = lease ? tenants.find(t => t.id === lease.tenantId) : null;
      const days = inv.status === 'overdue' ? daysOverdue(inv.dueDate) : 0;
      return [
        inv.invoiceNumber,
        prop?.name || '—',
        tenant?.name || '—',
        formatMonthYear(inv.month, inv.year),
        formatDate(inv.dueDate),
        inv.totalAmount.toFixed(2),
        inv.status,
        days,
      ];
    });
    exportCSV(`propmaster-outstanding-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const markOverdue = async (id: string) => {
    await updateInvoice(id, { status: 'overdue' });
    showToast('Invoice marked overdue');
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-4 border-l-4 border-red-400">
          <p className="text-xs text-gray-500 mb-1">Overdue</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
          <p className="text-xs text-gray-400">{outstanding.filter(i => i.status === 'overdue').length} invoices</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-400">
          <p className="text-xs text-gray-500 mb-1">Awaiting payment</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totals.sent)}</p>
          <p className="text-xs text-gray-400">{outstanding.filter(i => i.status === 'sent').length} invoices</p>
        </div>
        <div className="card p-4 border-l-4 border-gray-300">
          <p className="text-xs text-gray-500 mb-1">Draft</p>
          <p className="text-xl font-bold text-gray-700">{formatCurrency(totals.draft)}</p>
          <p className="text-xs text-gray-400">{outstanding.filter(i => i.status === 'draft').length} invoices</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Outstanding invoices
            <span className="ml-2 text-gray-400 font-normal">({outstanding.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            {outstanding.length > 0 && (
              <span className="text-sm font-bold text-gray-900">{formatCurrency(totals.total)}</span>
            )}
            <button onClick={handleExport} className="btn-secondary text-xs gap-1.5">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {outstanding.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
              <TrendingUp size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">All clear!</p>
            <p className="text-xs text-gray-400">No outstanding invoices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{minWidth:"640px"}}>
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  {['Invoice', 'Property', 'Tenant', 'Period', 'Due date', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstanding.map(inv => {
                  const prop = properties.find(p => p.id === inv.propertyId);
                  const lease = leases.find(l => l.id === inv.leaseId);
                  const tenant = lease ? tenants.find(t => t.id === lease.tenantId) : null;
                  const overdueDays = inv.status === 'overdue' ? daysOverdue(inv.dueDate) : 0;

                  return (
                    <tr key={inv.id} className="table-row">
                      <td className="table-cell">
                        <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm text-gray-700">{prop?.name || '—'}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm text-gray-700">{tenant?.name || '—'}</p>
                        {tenant?.email && <p className="text-xs text-gray-400">{tenant.email}</p>}
                      </td>
                      <td className="table-cell text-xs text-gray-600">
                        {formatMonthYear(inv.month, inv.year)}
                      </td>
                      <td className="table-cell">
                        <p className="text-xs text-gray-700">{formatDate(inv.dueDate)}</p>
                        {overdueDays > 0 && (
                          <p className="text-xs font-medium text-red-600">{overdueDays}d overdue</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-1.5">
                          {inv.status === 'sent' && (
                            <button
                              onClick={() => markOverdue(inv.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
                            >
                              Mark overdue
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="table-cell font-bold text-gray-900" colSpan={5}>Total outstanding</td>
                  <td className="table-cell font-bold text-gray-900">{formatCurrency(totals.total)}</td>
                  <td className="table-cell" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Reports Page ──────────────────────────────────────
const REPORT_TABS = [
  { id: 'pnl', label: 'Profit & Loss' },
  { id: 'rentroll', label: 'Rent Roll' },
  { id: 'outstanding', label: 'Outstanding' },
];

export function ReportsPage() {
  const [tab, setTab] = useState('pnl');
  const { invoices, user } = useApp();
  const overdueCount = invoices.filter(i => i.ownerId === user?.id && i.status === 'overdue').length;
  const sentCount = invoices.filter(i => i.ownerId === user?.id && i.status === 'sent').length;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Portfolio analytics and financial summaries"
      />

      {/* Alert banner if there are overdue invoices */}
      {overdueCount > 0 && (
        <div className="card p-4 border-red-200 bg-red-50 mb-5 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{overdueCount} overdue {overdueCount === 1 ? 'invoice' : 'invoices'}</span>
            {sentCount > 0 && ` and ${sentCount} awaiting payment`} — review in the Outstanding tab.
          </p>
          <button onClick={() => setTab('outstanding')} className="ml-auto text-xs font-medium text-red-700 underline flex-shrink-0">
            View →
          </button>
        </div>
      )}

      <Tabs tabs={REPORT_TABS} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'pnl' && <ProfitLossReport />}
        {tab === 'rentroll' && <RentRollReport />}
        {tab === 'outstanding' && <OutstandingReport />}
      </div>
    </div>
  );
}

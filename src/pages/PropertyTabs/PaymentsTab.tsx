import React, { useState } from 'react';
import { Plus, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmptyState, StatusBadge } from '../../components/UI';
import { RecordPaymentModal } from '../../components/RecordPaymentModal';
import { formatCurrency, formatDate } from '../../utils';

// ── Payments Tab ───────────────────────────────────────────
interface Props { propertyId: string; }

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

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, TrendingUp, AlertCircle, ChevronRight, Wrench, FileText, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatCard, StatusBadge, PriorityBadge } from '../components/UI';
import { formatCurrency, formatDate } from '../utils';

function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="shimmer h-3 w-16 rounded mb-2" />
      <div className="shimmer h-7 w-24 rounded mb-1" />
      <div className="shimmer h-3 w-20 rounded" />
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { properties, leases, invoices, payments, maintenanceRequests, tenants, user, dataLoading } = useApp();

  const myProperties = properties.filter(p => p.ownerId === user?.id);
  const myLeases = leases.filter(l => l.ownerId === user?.id && l.status === 'active');
  const myInvoices = invoices.filter(i => i.ownerId === user?.id);
  const myPayments = payments.filter(p => p.ownerId === user?.id);
  const myMaintenance = maintenanceRequests.filter(m => m.ownerId === user?.id);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const rentThisMonth = myPayments
    .filter(p => {
      const d = new Date(p.paymentDate);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear && p.status === 'verified';
    })
    .reduce((s, p) => s + p.amount, 0);

  const overdueInvoices = myInvoices.filter(i => i.status === 'overdue');
  const sentInvoices = myInvoices.filter(i => i.status === 'sent');
  const vacantProperties = myProperties.filter(p => !myLeases.find(l => l.propertyId === p.id));
  const recentPayments = [...myPayments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const recentMaintenance = [...myMaintenance].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
          {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening with your portfolio today.</p>
      </div>

      {/* Stats — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 stagger">
        {dataLoading ? (
          [1,2,3,4].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard title="Properties" value={String(myProperties.length)} sub={`${vacantProperties.length} vacant`} icon={<Building2 size={18} />} color="bg-brand-50 text-brand-700" onClick={() => navigate('/properties')} />
            <StatCard title="Active leases" value={String(myLeases.length)} sub={`of ${tenants.filter(t => t.ownerId === user?.id).length} tenants`} icon={<Users size={18} />} color="bg-teal-50 text-teal-700" onClick={() => navigate('/tenants')} />
            <StatCard title="Collected" value={formatCurrency(rentThisMonth)} sub={`${sentInvoices.length} awaiting`} icon={<TrendingUp size={18} />} color="bg-green-50 text-green-700" onClick={() => navigate('/payments')} />
            <StatCard title="Outstanding" value={String(overdueInvoices.length + sentInvoices.length)} sub={`${overdueInvoices.length} overdue`} icon={<AlertCircle size={18} />} color={overdueInvoices.length > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'} onClick={() => navigate('/invoices')} />
          </>
        )}
      </div>

      {/* Quick actions — 2x2 on mobile, 4-col on sm+ */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
          {[
            { label: 'Add property', icon: Building2, path: '/properties?add=1', color: 'bg-brand-50 text-brand-700' },
            { label: 'New invoice', icon: FileText, path: '/invoices?add=1', color: 'bg-green-50 text-green-700' },
            { label: 'Record payment', icon: CreditCard, path: '/payments?add=1', color: 'bg-teal-50 text-teal-700' },
            { label: 'Log maintenance', icon: Wrench, path: '/maintenance?add=1', color: 'bg-amber-50 text-amber-700' },
          ].map(({ label, icon: Icon, path, color }) => (
            <button key={label} onClick={() => navigate(path)}
              className="card card-lift p-3 sm:p-4 flex flex-col items-center gap-2 sm:gap-2.5 active:scale-95">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${color} flex items-center justify-center`}>
                <Icon size={18} />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity — stacked on mobile, side-by-side on lg */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent payments */}
        <div className="card">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-surface-100">
            <h3 className="font-semibold text-gray-900 text-sm">Recent payments</h3>
            <button onClick={() => navigate('/payments')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No payments recorded yet</div>
          ) : (
            <div className="divide-y divide-surface-100">
              {recentPayments.map(pay => {
                const prop = myProperties.find(p => p.id === pay.propertyId);
                return (
                  <div key={pay.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard size={14} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{prop?.name || 'Unknown property'}</p>
                      <p className="text-xs text-gray-500">{formatDate(pay.paymentDate)} · {pay.method?.toUpperCase()}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(pay.amount)}</p>
                      <StatusBadge status={pay.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Open maintenance */}
        <div className="card">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-surface-100">
            <h3 className="font-semibold text-gray-900 text-sm">Maintenance requests</h3>
            <button onClick={() => navigate('/maintenance')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          {recentMaintenance.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No maintenance requests</div>
          ) : (
            <div className="divide-y divide-surface-100">
              {recentMaintenance.map(req => {
                const prop = myProperties.find(p => p.id === req.propertyId);
                return (
                  <div key={req.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 cursor-pointer hover:bg-surface-50 transition-colors" onClick={() => navigate('/maintenance')}>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Wrench size={14} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                      <p className="text-xs text-gray-500 truncate">{prop?.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <PriorityBadge priority={req.priority} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Vacant properties alert */}
      {vacantProperties.length > 0 && (
        <div className="mt-4 sm:mt-6 card p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">
                {vacantProperties.length} vacant {vacantProperties.length === 1 ? 'property' : 'properties'}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 truncate">
                {vacantProperties.map(p => p.name).join(', ')}
              </p>
              <button onClick={() => navigate('/tenants')} className="text-xs text-amber-800 font-medium underline mt-1">
                Add a tenant →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav spacer on mobile */}
      <div className="h-4 lg:hidden" />
    </div>
  );
}

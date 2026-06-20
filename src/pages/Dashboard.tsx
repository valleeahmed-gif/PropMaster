import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, TrendingUp, AlertCircle, ChevronRight,
  Wrench, FileText, CreditCard, ArrowUpRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge, PriorityBadge } from '../components/UI';
import { formatCurrency, formatDate } from '../utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const { properties, leases, invoices, payments, maintenanceRequests, tenants, user } = useApp();

  // Scope to logged-in landlord
  const myProperties = properties.filter(p => p.ownerId === user?.id);
  const myLeases     = leases.filter(l => l.ownerId === user?.id && l.status === 'active');
  const myInvoices   = invoices.filter(i => i.ownerId === user?.id);
  const myPayments   = payments.filter(p => p.ownerId === user?.id);
  const myMaintenance = maintenanceRequests.filter(m => m.ownerId === user?.id);
  const myTenants    = tenants.filter(t => t.ownerId === user?.id);

  // This-month rent collected
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const rentThisMonth = myPayments
    .filter(p => {
      const d = new Date(p.paymentDate);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear && p.status === 'verified';
    })
    .reduce((s, p) => s + p.amount, 0);

  const overdueInvoices = myInvoices.filter(i => i.status === 'overdue');
  const sentInvoices    = myInvoices.filter(i => i.status === 'sent' || i.status === 'partial');
  const totalOutstanding = [...overdueInvoices, ...sentInvoices].reduce((s, i) => s + i.totalAmount, 0);
  const vacantProperties = myProperties.filter(p => !myLeases.find(l => l.propertyId === p.id));
  const recentPayments  = [...myPayments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const recentMaintenance = [...myMaintenance]
    .filter(m => m.status === 'open' || m.status === 'in_progress')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const greeting = now.getHours() < 12 ? 'Good morning' :
                   now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      {/* Hero greeting — distinctive, sets the tone */}
      <section className="mb-6 sm:mb-8">
        <p className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-2">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 tracking-tight leading-[1.05]">
          {greeting}, <em className="text-brand-700">{user?.name?.split(' ')[0]}</em>.
        </h1>
        <p className="text-sm sm:text-base text-ink-500 mt-2 max-w-xl">
          Here's how your portfolio is performing today.
        </p>
      </section>

      {/* Headline stats — 2x2 mobile, 4 desktop */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 stagger" aria-label="Portfolio summary">
        <StatTile
          label="Properties"
          value={String(myProperties.length)}
          sub={vacantProperties.length > 0 ? `${vacantProperties.length} vacant` : 'All occupied'}
          subTone={vacantProperties.length > 0 ? 'amber' : 'green'}
          icon={<Building2 size={18} />}
          iconBg="bg-brand-50 text-brand-700"
          onClick={() => navigate('/properties')}
        />
        <StatTile
          label="Active leases"
          value={String(myLeases.length)}
          sub={`${myTenants.length} ${myTenants.length === 1 ? 'tenant' : 'tenants'}`}
          icon={<Users size={18} />}
          iconBg="bg-brand-50 text-brand-700"
          onClick={() => navigate('/tenants')}
        />
        <StatTile
          label="Collected this month"
          value={formatCurrency(rentThisMonth)}
          sub={recentPayments.length > 0 ? `${recentPayments.length} payments` : 'No payments yet'}
          icon={<TrendingUp size={18} />}
          iconBg="bg-brass-50 text-brass-700"
          highlight
          onClick={() => navigate('/payments')}
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(totalOutstanding)}
          sub={overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue` : `${sentInvoices.length} pending`}
          subTone={overdueInvoices.length > 0 ? 'red' : 'amber'}
          icon={<AlertCircle size={18} />}
          iconBg={overdueInvoices.length > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
          onClick={() => navigate('/invoices')}
        />
      </section>

      {/* Quick actions */}
      <section className="mb-8" aria-label="Quick actions">
        <h2 className="section-title mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
          {[
            { label: 'Add property',   icon: Building2,  path: '/properties',  bg: 'bg-brand-50',  fg: 'text-brand-700' },
            { label: 'New invoice',    icon: FileText,   path: '/invoices',    bg: 'bg-brass-50',  fg: 'text-brass-700' },
            { label: 'Record payment', icon: CreditCard, path: '/payments',    bg: 'bg-brand-50',  fg: 'text-brand-700' },
            { label: 'Log maintenance',icon: Wrench,     path: '/maintenance', bg: 'bg-amber-50',  fg: 'text-amber-700' },
          ].map(({ label, icon: Icon, path, bg, fg }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="card card-lift p-4 flex flex-col items-center gap-3 text-center group"
            >
              <div className={`w-11 h-11 rounded-2xl ${bg} ${fg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <Icon size={20} />
              </div>
              <span className="text-xs font-semibold text-ink-700">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Activity */}
      <section className="grid lg:grid-cols-2 gap-4 sm:gap-6" aria-label="Recent activity">
        {/* Recent payments */}
        <div className="card overflow-hidden">
          <SectionHeader
            title="Recent payments"
            count={myPayments.length}
            onViewAll={() => navigate('/payments')}
          />
          {recentPayments.length === 0 ? (
            <EmptyPanel
              icon={<CreditCard size={20} className="text-ink-300" />}
              text="No payments recorded yet"
            />
          ) : (
            <ul className="divide-y divide-surface-100">
              {recentPayments.map(pay => {
                const prop = myProperties.find(p => p.id === pay.propertyId);
                return (
                  <li
                    key={pay.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors cursor-pointer"
                    onClick={() => navigate('/payments')}
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard size={15} className="text-brand-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate">{prop?.name || 'Unknown property'}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {formatDate(pay.paymentDate)} · {pay.method?.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-ink-900 tabular">{formatCurrency(pay.amount)}</p>
                      <StatusBadge status={pay.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Open maintenance */}
        <div className="card overflow-hidden">
          <SectionHeader
            title="Open maintenance"
            count={recentMaintenance.length}
            onViewAll={() => navigate('/maintenance')}
          />
          {recentMaintenance.length === 0 ? (
            <EmptyPanel
              icon={<Wrench size={20} className="text-ink-300" />}
              text="No open maintenance requests"
            />
          ) : (
            <ul className="divide-y divide-surface-100">
              {recentMaintenance.map(req => {
                const prop = myProperties.find(p => p.id === req.propertyId);
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors cursor-pointer"
                    onClick={() => navigate('/maintenance')}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Wrench size={15} className="text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate">{req.title}</p>
                      <p className="text-xs text-ink-500 mt-0.5 truncate">{prop?.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <PriorityBadge priority={req.priority} />
                      <StatusBadge status={req.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Vacant properties alert — only if there are vacancies */}
      {vacantProperties.length > 0 && (
        <section className="mt-6 card p-5 border-amber-200 bg-amber-50/40" role="status">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={18} className="text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-amber-900">
                {vacantProperties.length} vacant {vacantProperties.length === 1 ? 'property' : 'properties'}
              </h3>
              <p className="text-xs text-amber-800/80 mt-0.5 truncate">
                {vacantProperties.map(p => p.name).join(' · ')}
              </p>
            </div>
            <button
              onClick={() => navigate('/tenants')}
              className="text-xs font-bold text-amber-900 hover:text-amber-700 flex items-center gap-1 flex-shrink-0"
            >
              Add tenant <ArrowUpRight size={13} />
            </button>
          </div>
        </section>
      )}

      <div className="h-4 lg:hidden" />
    </div>
  );
}

// ── Stat Tile ──────────────────────────────────────────────
interface StatTileProps {
  label: string;
  value: string;
  sub: string;
  subTone?: 'green' | 'amber' | 'red';
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
  onClick?: () => void;
}

function StatTile({ label, value, sub, subTone, icon, iconBg, highlight, onClick }: StatTileProps) {
  const subColor = subTone === 'red'   ? 'text-red-600' :
                   subTone === 'amber' ? 'text-amber-700' :
                   subTone === 'green' ? 'text-brand-700' : 'text-ink-400';

  return (
    <button
      onClick={onClick}
      className={`stat-card card-lift text-left ${highlight ? 'ring-1 ring-brass-200' : ''}`}
      aria-label={`${label}: ${value}, ${sub}`}
    >
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xs font-bold text-ink-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-ink-900 leading-none tabular truncate">{value}</p>
      <p className={`text-xs font-medium mt-1.5 ${subColor}`}>{sub}</p>
    </button>
  );
}

// ── Section Header ─────────────────────────────────────────
function SectionHeader({ title, count, onViewAll }: { title: string; count: number; onViewAll: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
      <div className="flex items-center gap-2.5">
        <h3 className="font-bold text-ink-900 text-sm">{title}</h3>
        {count > 0 && (
          <span className="text-2xs font-bold text-ink-500 bg-surface-100 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <button
        onClick={onViewAll}
        className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1"
      >
        View all <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ── Empty Panel ────────────────────────────────────────────
function EmptyPanel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-sm text-ink-400">{text}</p>
    </div>
  );
}

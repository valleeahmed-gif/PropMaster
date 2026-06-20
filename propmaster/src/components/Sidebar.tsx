import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, FileText, CreditCard,
  Wrench, LogOut, X, ChevronRight, BarChart2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LogoIcon } from './Logo';

const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/properties',  label: 'Properties',  icon: Building2 },
  { path: '/tenants',     label: 'Tenants',     icon: Users },
  { path: '/invoices',    label: 'Invoices',    icon: FileText },
  { path: '/payments',    label: 'Payments',    icon: CreditCard },
  { path: '/maintenance', label: 'Maintenance', icon: Wrench },
  { path: '/reports',     label: 'Reports',     icon: BarChart2 },
];

interface SidebarProps { mobile?: boolean; }

export function Sidebar({ mobile }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setSidebarOpen } = useApp();

  const go = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const isActive = (path: string) => location.pathname.startsWith(path);
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="flex flex-col h-full text-white">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <LogoIcon size={36} />
          <div>
            <p className="font-bold text-white text-[15px] tracking-tight leading-none">PropMaster</p>
            <p className="text-[10px] text-white/40 tracking-widest uppercase mt-1">Landlord portal</p>
          </div>
        </div>
        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X size={16} className="text-white/70" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => go(path)}
              className={`nav-item ${active ? 'nav-item-active' : 'nav-item-inactive'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="opacity-50" />}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pt-3 pb-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #cea22a 0%, #7e5414 100%)' }}>
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-2xs text-white/40 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="nav-item nav-item-inactive w-full"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export function MobileSidebarOverlay() {
  const { sidebarOpen, setSidebarOpen } = useApp();
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden animate-fade-in"
          style={{ background: 'rgba(3, 36, 31, 0.5)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed left-0 top-0 bottom-0 w-72 z-50 lg:hidden transition-transform duration-300 ease-out shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #094c40 0%, #03241f 100%)' }}
        role="dialog"
        aria-label="Navigation menu"
      >
        <Sidebar mobile />
      </div>
    </>
  );
}

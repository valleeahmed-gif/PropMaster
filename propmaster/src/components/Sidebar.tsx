import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, FileText, CreditCard,
  Wrench, LogOut, X, ChevronRight, BarChart2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LogoIcon } from './Logo';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/properties', label: 'Properties', icon: Building2 },
  { path: '/tenants', label: 'Tenants', icon: Users },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/payments', label: 'Payments', icon: CreditCard },
  { path: '/maintenance', label: 'Maintenance', icon: Wrench },
  { path: '/reports', label: 'Reports', icon: BarChart2 },
];

interface SidebarProps {
  mobile?: boolean;
}

export function Sidebar({ mobile }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, sidebarOpen, setSidebarOpen } = useApp();

  const go = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide">PropMaster</span>
        </div>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} className="text-white/70" />
          </button>
        )}
      </div>

      {/* User */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brass-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/50 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => go(path)}
            className={`nav-item ${isActive(path) ? 'nav-item-active' : 'nav-item-inactive'}`}
          >
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {isActive(path) && <ChevronRight size={14} className="opacity-60" />}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="nav-item nav-item-inactive text-white/60 hover:text-white w-full"
        >
          <LogOut size={17} />
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`fixed left-0 top-0 bottom-0 w-64 z-50 lg:hidden transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0c4f43 0%, #052520 100%)' }}>
        <Sidebar mobile />
      </div>
    </>
  );
}

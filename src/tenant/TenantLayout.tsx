import React, { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, CreditCard, Wrench, LogOut, WifiOff } from 'lucide-react';
import { useTenant } from './TenantContext';
import { LogoIcon } from '../components/Logo';
import { ToastContainer } from '../components/UI';

const TENANT_NAV = [
  { path: '/tenant/home',        label: 'Home',        icon: Home },
  { path: '/tenant/invoices',    label: 'Invoices',    icon: FileText },
  { path: '/tenant/payments',    label: 'Payments',    icon: CreditCard },
  { path: '/tenant/maintenance', label: 'Maintenance', icon: Wrench },
];

// ── Bottom nav ─────────────────────────────────────────────
function TenantBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <div className="h-20" aria-hidden="true" />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '0.5px solid rgba(220, 222, 213, 0.8)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Primary navigation"
      >
        <div className="flex items-stretch h-16 max-w-2xl mx-auto">
          {TENANT_NAV.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-90 focus-visible:outline-none"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <div className={`w-11 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                  active ? 'bg-brand-600 shadow-sm' : ''
                }`}>
                  <Icon
                    size={18}
                    className={active ? 'text-white' : 'text-ink-400'}
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                </div>
                <span className={`text-[10px] font-semibold transition-colors ${
                  active ? 'text-brand-700' : 'text-ink-400'
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// ── Layout ─────────────────────────────────────────────────
interface TenantLayoutProps { children: ReactNode; }

export function TenantLayout({ children }: TenantLayoutProps) {
  const { user, property, logout, toasts, dismissToast } = useTenant();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Skip link */}
      <a href="#tenant-content" className="skip-link">Skip to content</a>

      {/* Header */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-surface-200"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoIcon size={30} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900 leading-tight tracking-tight">PropMaster</p>
              {property && (
                <p className="text-2xs text-ink-400 leading-tight truncate max-w-[180px]">
                  {property.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #cea22a 0%, #7e5414 100%)' }}
              aria-label={`Signed in as ${user?.name}`}
            >
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-surface-100 transition-colors text-ink-400 hover:text-ink-700"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div
          role="alert"
          className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 justify-center"
        >
          <WifiOff size={13} /> You're offline
        </div>
      )}

      {/* Main */}
      <main
        id="tenant-content"
        tabIndex={-1}
        className="max-w-2xl mx-auto px-4 py-5 page-enter"
      >
        {children}
      </main>

      <TenantBottomNav />
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}

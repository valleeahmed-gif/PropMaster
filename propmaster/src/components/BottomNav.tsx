import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, FileText, CreditCard, MoreHorizontal } from 'lucide-react';

const BOTTOM_NAV = [
  { path: '/dashboard',  label: 'Home',       icon: LayoutDashboard },
  { path: '/properties', label: 'Properties', icon: Building2 },
  { path: '/invoices',   label: 'Invoices',   icon: FileText },
  { path: '/payments',   label: 'Payments',   icon: CreditCard },
  { path: '/more',       label: 'More',       icon: MoreHorizontal },
];

const MORE_PATHS = ['/tenants', '/maintenance', '/reports', '/more'];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/more') return MORE_PATHS.some(p => location.pathname.startsWith(p));
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Spacer */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '0.5px solid rgba(220, 222, 213, 0.8)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Primary navigation"
      >
        <div className="flex items-stretch h-16">
          {BOTTOM_NAV.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path === '/more' ? '/tenants' : path)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-90 focus-visible:outline-none"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <div
                  className={`w-11 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                    active ? 'bg-brand-600 shadow-sm' : ''
                  }`}
                >
                  <Icon
                    size={18}
                    className={active ? 'text-white' : 'text-ink-400'}
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                </div>
                <span
                  className={`text-[10px] font-semibold transition-colors ${
                    active ? 'text-brand-700' : 'text-ink-400'
                  }`}
                >
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

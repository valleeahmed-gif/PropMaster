import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, FileText, CreditCard, MoreHorizontal } from 'lucide-react';

const BOTTOM_NAV = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/properties', label: 'Properties', icon: Building2 },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/payments', label: 'Payments', icon: CreditCard },
  { path: '/more', label: 'More', icon: MoreHorizontal },
];

// "More" paths — used to highlight the More tab when on these routes
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
      {/* Spacer so content doesn't hide behind the nav */}
      <div className="h-20 lg:hidden" />

      {/* Bottom nav bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '0.5px solid #e8ecf4',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-stretch h-16">
          {BOTTOM_NAV.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path === '/more' ? '/tenants' : path)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
              >
                <div className={`w-10 h-7 rounded-2xl flex items-center justify-center transition-all ${
                  active ? 'bg-brand-600' : ''
                }`}>
                  <Icon
                    size={18}
                    className={active ? 'text-white' : 'text-gray-400'}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-brand-700' : 'text-gray-400'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

import React, { ReactNode, useState, useEffect } from 'react';
import { Menu, Bell, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, MobileSidebarOverlay } from './Sidebar';
import { LogoIcon } from './Logo';
import { ToastContainer } from './UI';
import { BottomNav } from './BottomNav';
import { useApp } from '../context/AppContext';

interface LayoutProps { children: ReactNode; }

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { setSidebarOpen, maintenanceRequests, invoices } = useApp();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Combined notification count: open maintenance + overdue invoices
  const openMaintenance = maintenanceRequests.filter(m => m.status === 'open').length;
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
  const notificationCount = openMaintenance + overdueInvoices;

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

  return (
    <div className="flex h-screen overflow-hidden bg-surface-100">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, #094c40 0%, #03241f 100%)' }}
        aria-label="Sidebar navigation"
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      <MobileSidebarOverlay />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-surface-200 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-surface-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} className="text-ink-700" />
          </button>
          <div className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="font-bold text-ink-900 text-sm tracking-tight">PropMaster</span>
          </div>
          <button
            onClick={() => navigate('/maintenance')}
            className="relative p-2 -mr-2 rounded-lg hover:bg-surface-100 transition-colors"
            aria-label={`${notificationCount} notifications`}
          >
            <Bell size={19} className="text-ink-700" />
            {notificationCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div
            role="alert"
            className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 justify-center flex-shrink-0"
          >
            <WifiOff size={13} />
            You're offline — changes won't save until you reconnect
          </div>
        )}

        {/* Main content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          <div
            key={typeof window !== 'undefined' ? window.location.pathname : ''}
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 page-enter"
          >
            {children}
          </div>
        </main>
      </div>

      <ToastContainer />
      <BottomNav />
    </div>
  );
}

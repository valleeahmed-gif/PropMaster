import React, { ReactNode, useState, useEffect } from 'react';
import { Menu, Bell, WifiOff } from 'lucide-react';
import { Sidebar, MobileSidebarOverlay } from './Sidebar';
import { LogoIcon } from './Logo';
import { ToastContainer } from './UI';
import { BottomNav } from './BottomNav';
import { useApp } from '../context/AppContext';

interface LayoutProps { children: ReactNode; }

export function Layout({ children }: LayoutProps) {
  const { setSidebarOpen, maintenanceRequests } = useApp();
  const openCount = maintenanceRequests.filter(m => m.status === 'open').length;
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-100">
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, #0c4f43 0%, #052520 100%)' }}>
        <Sidebar />
      </aside>

      <MobileSidebarOverlay />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-surface-200 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <LogoIcon size={30} />
            <span className="font-bold text-gray-900 text-sm" style={{letterSpacing:'-0.02em'}}>PropMaster</span>
          </div>
          <div className="relative">
            <button className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
              <Bell size={20} className="text-gray-600" />
            </button>
            {openCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {openCount}
              </span>
            )}
          </div>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-white text-xs font-medium px-4 py-2 flex items-center gap-2 justify-center flex-shrink-0">
            <WifiOff size={13} /> You're offline — changes won't save until you reconnect
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div key={typeof window !== "undefined" ? window.location.pathname : ""} className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 page-enter">
            {children}
          </div>
        </main>
      </div>

      <ToastContainer />
      <BottomNav />
    </div>
  );
}

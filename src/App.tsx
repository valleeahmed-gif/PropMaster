import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TenantProvider, useTenant } from './tenant/TenantContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader, DashboardSkeleton, PageSkeleton } from './components/Skeleton';

// ── Eagerly-loaded (auth flow) ─────────────────────────────
import { Layout } from './components/Layout';
import { TenantLayout } from './tenant/TenantLayout';
import { LoginPage, SignupPage } from './pages/Auth';

// ── Lazy-loaded routes — reduces initial bundle ────────────
// After a deploy, an open tab may request chunk files that no longer exist.
// Reload once to pick up the new build instead of showing a broken page.
function lazyPage<T extends Record<string, any>>(load: () => Promise<T>, name: keyof T) {
  return lazy(async () => {
    const KEY = 'pm-chunk-reload';
    try {
      const mod = await load();
      try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
      return { default: mod[name] as React.ComponentType<any> };
    } catch (err) {
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
      if (!alreadyReloaded) {
        window.location.reload();
        return new Promise<never>(() => {}); // wait for the reload
      }
      throw err;
    }
  });
}

const loadGlobal = () => import('./pages/GlobalPages');
const loadTenant = () => import('./tenant/TenantPages');

const AcceptInvitePage      = lazyPage(() => import('./pages/AcceptInvite'), 'AcceptInvitePage');
const DashboardPage         = lazyPage(() => import('./pages/Dashboard'), 'DashboardPage');
const PropertiesPage        = lazyPage(() => import('./pages/Properties'), 'PropertiesPage');
const PropertyDetailPage    = lazyPage(() => import('./pages/Properties'), 'PropertyDetailPage');
const ReportsPage           = lazyPage(() => import('./pages/Reports'), 'ReportsPage');
const TenantsPage           = lazyPage(loadGlobal, 'TenantsPage');
const InvoicesPage          = lazyPage(loadGlobal, 'InvoicesPage');
const PaymentsPage          = lazyPage(loadGlobal, 'PaymentsPage');
const MaintenancePage       = lazyPage(loadGlobal, 'MaintenancePage');
const TenantHomePage        = lazyPage(loadTenant, 'TenantHomePage');
const TenantInvoicesPage    = lazyPage(loadTenant, 'TenantInvoicesPage');
const TenantPaymentsPage    = lazyPage(loadTenant, 'TenantPaymentsPage');
const TenantMaintenancePage = lazyPage(loadTenant, 'TenantMaintenancePage');

const page = (el: React.ReactNode, fallback: React.ReactNode = <PageSkeleton />) =>
  <Suspense fallback={fallback}>{el}</Suspense>;

// ── Route guards ───────────────────────────────────────────
function LandlordRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useApp();
  if (authLoading) return <PageLoader label="Loading PropMaster…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'tenant') return <Navigate to="/tenant/home" replace />;
  return <Layout>{children}</Layout>;
}

function TenantRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useTenant();
  if (authLoading) return <PageLoader label="Loading your portal…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <TenantLayout>{children}</TenantLayout>;
}

function RootRedirect() {
  const { user, authLoading } = useApp();
  if (authLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'tenant') return <Navigate to="/tenant/home" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ── Main routes ────────────────────────────────────────────
function AppRoutes() {
  const { user, authLoading } = useApp();
  if (authLoading) return <PageLoader />;

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/login" element={
        !user ? <LoginPage /> :
        user.role === 'tenant' ? <Navigate to="/tenant/home" replace /> :
        <Navigate to="/dashboard" replace />
      } />
      <Route path="/signup" element={
        !user ? <SignupPage /> :
        user.role === 'tenant' ? <Navigate to="/tenant/home" replace /> :
        <Navigate to="/dashboard" replace />
      } />

      {/* Landlord portal */}
      <Route path="/dashboard"      element={<LandlordRoute>{page(<DashboardPage />, <DashboardSkeleton />)}</LandlordRoute>} />
      <Route path="/properties"     element={<LandlordRoute>{page(<PropertiesPage />)}</LandlordRoute>} />
      <Route path="/properties/:id" element={<LandlordRoute>{page(<PropertyDetailPage />)}</LandlordRoute>} />
      <Route path="/tenants"        element={<LandlordRoute>{page(<TenantsPage />)}</LandlordRoute>} />
      <Route path="/invoices"       element={<LandlordRoute>{page(<InvoicesPage />)}</LandlordRoute>} />
      <Route path="/payments"       element={<LandlordRoute>{page(<PaymentsPage />)}</LandlordRoute>} />
      <Route path="/maintenance"    element={<LandlordRoute>{page(<MaintenancePage />)}</LandlordRoute>} />
      <Route path="/reports"        element={<LandlordRoute>{page(<ReportsPage />)}</LandlordRoute>} />

      {/* Accept invite */}
      <Route path="/accept-invite" element={
        page(<AcceptInvitePage />, <PageLoader label="Loading…" />)
      } />

      {/* Tenant portal */}
      <Route path="/tenant/*" element={
        <TenantProvider>
          <Routes>
            <Route path="home"        element={<TenantRoute>{page(<TenantHomePage />)}</TenantRoute>} />
            <Route path="invoices"    element={<TenantRoute>{page(<TenantInvoicesPage />)}</TenantRoute>} />
            <Route path="payments"    element={<TenantRoute>{page(<TenantPaymentsPage />)}</TenantRoute>} />
            <Route path="maintenance" element={<TenantRoute>{page(<TenantMaintenancePage />)}</TenantRoute>} />
            <Route path="*"           element={<Navigate to="home" replace />} />
          </Routes>
        </TenantProvider>
      } />

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/app">
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

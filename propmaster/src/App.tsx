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
const AcceptInvitePage   = lazy(() => import('./pages/AcceptInvite').then(m => ({ default: m.AcceptInvitePage })));
const DashboardPage      = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.DashboardPage })));
const PropertiesPage     = lazy(() => import('./pages/Properties').then(m => ({ default: m.PropertiesPage })));
const PropertyDetailPage = lazy(() => import('./pages/Properties').then(m => ({ default: m.PropertyDetailPage })));
const ReportsPage        = lazy(() => import('./pages/Reports').then(m => ({ default: m.ReportsPage })));

// ── Lazy global pages — multi-export module needs a wrapper ─
function GlobalPagesWrapper({ kind }: { kind: 'tenants' | 'invoices' | 'payments' | 'maintenance' }) {
  const [Component, setComponent] = React.useState<React.ComponentType | null>(null);
  React.useEffect(() => {
    import('./pages/GlobalPages').then(m => {
      const map: any = {
        tenants:     m.TenantsPage,
        invoices:    m.InvoicesPage,
        payments:    m.PaymentsPage,
        maintenance: m.MaintenancePage,
      };
      setComponent(() => map[kind]);
    });
  }, [kind]);
  if (!Component) return <PageSkeleton />;
  return <Component />;
}

// ── Lazy tenant pages — same pattern ────────────────────────
function LazyTenantPage({ kind }: { kind: 'home' | 'invoices' | 'payments' | 'maintenance' }) {
  const [Component, setComponent] = React.useState<React.ComponentType | null>(null);
  React.useEffect(() => {
    import('./tenant/TenantPages').then(m => {
      const map: any = {
        home:        m.TenantHomePage,
        invoices:    m.TenantInvoicesPage,
        payments:    m.TenantPaymentsPage,
        maintenance: m.TenantMaintenancePage,
      };
      setComponent(() => map[kind]);
    });
  }, [kind]);
  if (!Component) return <PageSkeleton />;
  return <Component />;
}

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
      <Route path="/dashboard"  element={<LandlordRoute><Suspense fallback={<DashboardSkeleton />}><DashboardPage /></Suspense></LandlordRoute>} />
      <Route path="/properties" element={<LandlordRoute><Suspense fallback={<PageSkeleton />}><PropertiesPage /></Suspense></LandlordRoute>} />
      <Route path="/properties/:id" element={<LandlordRoute><Suspense fallback={<PageSkeleton />}><PropertyDetailPage /></Suspense></LandlordRoute>} />
      <Route path="/tenants"     element={<LandlordRoute><GlobalPagesWrapper kind="tenants" /></LandlordRoute>} />
      <Route path="/invoices"    element={<LandlordRoute><GlobalPagesWrapper kind="invoices" /></LandlordRoute>} />
      <Route path="/payments"    element={<LandlordRoute><GlobalPagesWrapper kind="payments" /></LandlordRoute>} />
      <Route path="/maintenance" element={<LandlordRoute><GlobalPagesWrapper kind="maintenance" /></LandlordRoute>} />
      <Route path="/reports"     element={<LandlordRoute><Suspense fallback={<PageSkeleton />}><ReportsPage /></Suspense></LandlordRoute>} />

      {/* Accept invite */}
      <Route path="/accept-invite" element={
        <Suspense fallback={<PageLoader label="Loading…" />}>
          <AcceptInvitePage />
        </Suspense>
      } />

      {/* Tenant portal */}
      <Route path="/tenant/*" element={
        <TenantProvider>
          <Routes>
            <Route path="home"        element={<TenantRoute><LazyTenantPage kind="home" /></TenantRoute>} />
            <Route path="invoices"    element={<TenantRoute><LazyTenantPage kind="invoices" /></TenantRoute>} />
            <Route path="payments"    element={<TenantRoute><LazyTenantPage kind="payments" /></TenantRoute>} />
            <Route path="maintenance" element={<TenantRoute><LazyTenantPage kind="maintenance" /></TenantRoute>} />
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

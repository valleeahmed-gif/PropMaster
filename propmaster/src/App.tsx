import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { LoginPage, SignupPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { PropertiesPage, PropertyDetailPage } from './pages/Properties';
import { TenantsPage, InvoicesPage, PaymentsPage, MaintenancePage } from './pages/GlobalPages';
import { ReportsPage } from './pages/Reports';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useApp();
  if (authLoading) return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-full animate-spin"
          style={{ width: 36, height: 36, borderWidth: 3, borderStyle: 'solid', borderTopColor: '#0e7c64', borderColor: '#d6f3e7' }} />
        <p className="text-sm text-gray-500">Loading PropMaster…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, authLoading } = useApp();
  if (authLoading) return null;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
      <Route path="/properties/:id" element={<ProtectedRoute><PropertyDetailPage /></ProtectedRoute>} />
      <Route path="/tenants" element={<ProtectedRoute><TenantsPage /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><MaintenancePage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    // basepath = /app so all routes are under /app/*
    <BrowserRouter basename="/app">
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

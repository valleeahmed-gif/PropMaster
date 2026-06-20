import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Tenant, Lease, Property, Invoice, Payment, MaintenanceRequest, Toast, User } from '../types';
import { generateId } from '../utils';

// ── Shape ──────────────────────────────────────────────────
interface TenantState {
  user: User | null;
  session: Session | null;
  authLoading: boolean;
  dataLoading: boolean;
  // null while loading, then set after first refresh
  tenantRecord: Tenant | null;
  activeLease: Lease | null;
  property: Property | null;
  invoices: Invoice[];
  payments: Payment[];
  maintenanceRequests: MaintenanceRequest[];
  toasts: Toast[];
  // True if we've completed at least one data load successfully
  initialized: boolean;
  // Error state during data load
  loadError: string | null;
}

interface TenantActions {
  logout: () => Promise<void>;
  submitMaintenanceRequest: (data: { title: string; description: string; priority: string }) => Promise<void>;
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
  refreshData: () => Promise<void>;
}

type TenantContextType = TenantState & TenantActions;
const TenantContext = createContext<TenantContextType | null>(null);

// ── Mappers (row → typed object) ───────────────────────────
const mapTenant = (r: any): Tenant => ({
  id: r.id, ownerId: r.owner_id, userId: r.user_id, name: r.name,
  email: r.email, phone: r.phone || '', inviteStatus: r.invite_status, createdAt: r.created_at,
});
const mapLease = (r: any): Lease => ({
  id: r.id, propertyId: r.property_id, tenantId: r.tenant_id, ownerId: r.owner_id,
  startDate: r.start_date, endDate: r.end_date, rentAmount: r.rent_amount,
  depositPaid: r.deposit_paid, status: r.status, createdAt: r.created_at,
});
const mapProperty = (r: any): Property => ({
  id: r.id, ownerId: r.owner_id, name: r.name, address: r.address,
  city: r.city, province: r.province, rentAmount: r.rent_amount,
  unitNumber: r.unit_number ?? undefined, erfSize: r.erf_size ?? undefined,
  leaseStart: r.lease_start, leaseEnd: r.lease_end, createdAt: r.created_at,
});
const mapInvoice = (r: any): Invoice => ({
  id: r.id, propertyId: r.property_id, leaseId: r.lease_id, ownerId: r.owner_id,
  invoiceNumber: r.invoice_number, month: r.month, year: r.year, dueDate: r.due_date,
  lineItems: r.line_items || [], totalAmount: r.total_amount, status: r.status, createdAt: r.created_at,
});
const mapPayment = (r: any): Payment => ({
  id: r.id, propertyId: r.property_id, leaseId: r.lease_id, invoiceId: r.invoice_id,
  ownerId: r.owner_id, amount: r.amount, paymentDate: r.payment_date,
  method: r.payment_method || r.method, payfastPaymentId: r.payfast_payment_id,
  status: r.status, notes: r.notes, createdAt: r.created_at,
});
const mapMaintenance = (r: any): MaintenanceRequest => ({
  id: r.id, propertyId: r.property_id, leaseId: r.lease_id, tenantId: r.tenant_id,
  ownerId: r.owner_id, title: r.title, description: r.description || '',
  status: r.status, priority: r.priority, images: r.images,
  resolutionNote: r.resolution_note ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ── Provider ───────────────────────────────────────────────
export function TenantProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tenantRecord, setTenantRecord] = useState<Tenant | null>(null);
  const [activeLease, setActiveLease] = useState<Lease | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Toasts ──────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Role guard ──────────────────────────────────────────
  // Confirms the authenticated user is actually a tenant before loading data.
  const verifyTenantRole = useCallback(async (uid: string): Promise<boolean> => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', uid)
      .maybeSingle();
    return data?.role === 'tenant';
  }, []);

  // ── Data loader ────────────────────────────────────────
  const refreshData = useCallback(async () => {
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    if (!sbUser) return;

    setDataLoading(true);
    setLoadError(null);

    try {
      // 0. Verify role first — bail fast if not a tenant
      const isTenant = await verifyTenantRole(sbUser.id);
      if (!isTenant) {
        setLoadError('Your account is not configured as a tenant. Please contact your landlord.');
        return;
      }

      // 1. Find the tenant record linked to this auth user
      const { data: tenantData, error: tErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', sbUser.id)
        .maybeSingle();

      if (tErr) throw tErr;

      if (!tenantData) {
        setLoadError('No tenant record linked to your account. Please contact your landlord.');
        return;
      }

      const tenant = mapTenant(tenantData);
      setTenantRecord(tenant);

      // 2. Find the active lease
      const { data: leaseData, error: lErr } = await supabase
        .from('leases')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .maybeSingle();

      if (lErr) throw lErr;

      if (!leaseData) {
        // Tenant linked but no active lease — partial state, show empty
        setActiveLease(null);
        setProperty(null);
        setInvoices([]);
        setPayments([]);
        setMaintenanceRequests([]);
        return;
      }

      const lease = mapLease(leaseData);
      setActiveLease(lease);

      // 3. Load property + invoices + payments + maintenance in parallel
      const [
        { data: propData, error: pErr },
        { data: invData },
        { data: payData },
        { data: maintData },
      ] = await Promise.all([
        supabase.from('properties').select('*').eq('id', lease.propertyId).maybeSingle(),
        supabase.from('invoices').select('*').eq('lease_id', lease.id).order('due_date', { ascending: false }),
        supabase.from('payments').select('*').eq('lease_id', lease.id).eq('status', 'verified').order('payment_date', { ascending: false }),
        supabase.from('maintenance_requests').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      ]);

      if (pErr) throw pErr;

      if (propData) setProperty(mapProperty(propData));
      setInvoices((invData || []).map(mapInvoice));
      setPayments((payData || []).map(mapPayment));
      setMaintenanceRequests((maintData || []).map(mapMaintenance));

      // ── Auto-flag overdue invoices on the client ─────────
      // Same logic as landlord portal: any sent/partial invoice past due_date
      // shows as overdue. We don't write back here (RLS prevents tenant updates).
      const today = new Date(); today.setHours(0, 0, 0, 0);
      setInvoices(prev => prev.map(i => {
        if ((i.status === 'sent' || i.status === 'partial') && i.dueDate) {
          const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
          if (due < today) return { ...i, status: 'overdue' as const };
        }
        return i;
      }));

    } catch (err: any) {
      console.error('Tenant data load error:', err);
      setLoadError(err.message || 'Failed to load your data. Please try again.');
    } finally {
      setDataLoading(false);
      setInitialized(true);
    }
  }, [verifyTenantRole]);

  // ── Auth listener ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(s);
      if (s?.user) {
        setUser({
          id: s.user.id,
          name: s.user.user_metadata?.name || s.user.email || '',
          email: s.user.email || '',
          role: 'tenant',
          createdAt: s.user.created_at,
        });
        await refreshData();
      }
      setAuthLoading(false);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      setSession(s);

      if (event === 'SIGNED_OUT' || !s?.user) {
        setUser(null);
        setTenantRecord(null);
        setActiveLease(null);
        setProperty(null);
        setInvoices([]);
        setPayments([]);
        setMaintenanceRequests([]);
        setInitialized(false);
        setLoadError(null);
        return;
      }

      setUser({
        id: s.user.id,
        name: s.user.user_metadata?.name || s.user.email || '',
        email: s.user.email || '',
        role: 'tenant',
        createdAt: s.user.created_at,
      });
      await refreshData();
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [refreshData]);

  // ── Actions ─────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const submitMaintenanceRequest = useCallback(async (data: { title: string; description: string; priority: string }) => {
    if (!activeLease || !tenantRecord || !property) {
      throw new Error('No active lease found — please contact your landlord');
    }

    const { data: row, error } = await supabase.from('maintenance_requests').insert({
      property_id: property.id,
      lease_id: activeLease.id,
      tenant_id: tenantRecord.id,
      owner_id: activeLease.ownerId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: 'open',
    }).select().single();

    if (error) throw error;
    setMaintenanceRequests(prev => [mapMaintenance(row), ...prev]);
  }, [activeLease, tenantRecord, property]);

  const value: TenantContextType = {
    user, session, authLoading, dataLoading, initialized, loadError,
    tenantRecord, activeLease, property, invoices, payments, maintenanceRequests, toasts,
    logout, submitMaintenanceRequest, showToast, dismissToast, refreshData,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  User, Property, Tenant, Lease, PropertyCost, UtilityBreakdown,
  Invoice, Payment, MaintenanceRequest, StatementUpload, Toast
} from '../types';
import { generateId, today, APP_URL } from '../utils';

interface AppState {
  user: User | null;
  session: Session | null;
  authLoading: boolean;
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  propertyCosts: PropertyCost[];
  utilityBreakdowns: UtilityBreakdown[];
  invoices: Invoice[];
  payments: Payment[];
  maintenanceRequests: MaintenanceRequest[];
  statementUploads: StatementUpload[];
  toasts: Toast[];
  sidebarOpen: boolean;
  dataLoading: boolean;
}

interface AppActions {
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  addProperty: (data: Omit<Property, 'id' | 'ownerId' | 'createdAt'>) => Promise<Property>;
  updateProperty: (id: string, data: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  addTenant: (data: Omit<Tenant, 'id' | 'ownerId' | 'createdAt' | 'inviteStatus'>) => Promise<Tenant>;
  updateTenant: (id: string, data: Partial<Tenant>) => Promise<void>;
  inviteTenant: (tenantId: string) => Promise<void>;
  addLease: (data: Omit<Lease, 'id' | 'ownerId' | 'createdAt'>) => Promise<Lease>;
  updateLease: (id: string, data: Partial<Lease>) => Promise<void>;
  endLease: (id: string) => Promise<void>;
  addPropertyCost: (data: Omit<PropertyCost, 'id' | 'ownerId' | 'createdAt' | 'totalAmount'>) => Promise<PropertyCost>;
  updatePropertyCost: (id: string, data: Partial<PropertyCost>) => Promise<void>;
  deletePropertyCost: (id: string) => Promise<void>;
  addUtilityBreakdown: (data: Omit<UtilityBreakdown, 'id' | 'createdAt'>) => Promise<UtilityBreakdown>;
  updateUtilityBreakdown: (id: string, data: Partial<UtilityBreakdown>) => Promise<void>;
  deleteUtilityBreakdown: (id: string) => Promise<void>;
  addInvoice: (data: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'invoiceNumber'>) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addPayment: (data: Omit<Payment, 'id' | 'ownerId' | 'createdAt'>) => Promise<Payment>;
  addMaintenanceRequest: (data: Omit<MaintenanceRequest, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<MaintenanceRequest>;
  updateMaintenanceRequest: (id: string, data: Partial<MaintenanceRequest>) => Promise<void>;
  addStatementUpload: (data: Omit<StatementUpload, 'id' | 'ownerId' | 'uploadedAt' | 'extractionStatus'>) => Promise<StatementUpload>;
  updateStatementUpload: (id: string, data: Partial<StatementUpload>) => Promise<void>;
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  refreshData: () => Promise<void>;
}

type AppContextType = AppState & AppActions;
const AppContext = createContext<AppContextType | null>(null);

// ── snake_case → camelCase mappers ─────────────────────────
const mapProperty = (r: any): Property => ({
  id: r.id, ownerId: r.owner_id, name: r.name, address: r.address,
  city: r.city, province: r.province, rentAmount: r.rent_amount,
  unitNumber: r.unit_number ?? undefined,
  erfSize: r.erf_size ?? undefined,
  leaseStart: r.lease_start, leaseEnd: r.lease_end, createdAt: r.created_at,
});
const mapTenant = (r: any): Tenant => ({
  id: r.id, ownerId: r.owner_id, userId: r.user_id, name: r.name,
  email: r.email, phone: r.phone || '', inviteStatus: r.invite_status, createdAt: r.created_at,
});
const mapLease = (r: any): Lease => ({
  id: r.id, propertyId: r.property_id, tenantId: r.tenant_id, ownerId: r.owner_id,
  startDate: r.start_date, endDate: r.end_date, rentAmount: r.rent_amount,
  depositPaid: r.deposit_paid, status: r.status, createdAt: r.created_at,
});
const mapPropertyCost = (r: any): PropertyCost => ({
  id: r.id, propertyId: r.property_id, ownerId: r.owner_id, month: r.month,
  year: r.year, totalAmount: r.total_amount, notes: r.notes, createdAt: r.created_at,
});
const mapUtilityBreakdown = (r: any): UtilityBreakdown => ({
  id: r.id, propertyCostId: r.property_cost_id, label: r.label,
  amount: r.amount, isRecoverable: r.is_recoverable, isRecurring: r.is_recurring ?? false, createdAt: r.created_at,
});
const mapInvoice = (r: any): Invoice => ({
  id: r.id, propertyId: r.property_id, leaseId: r.lease_id, ownerId: r.owner_id,
  invoiceNumber: r.invoice_number, month: r.month, year: r.year, dueDate: r.due_date,
  lineItems: r.line_items, totalAmount: r.total_amount, status: r.status, createdAt: r.created_at,
});
const mapPayment = (r: any): Payment => ({
  id: r.id, propertyId: r.property_id, leaseId: r.lease_id, invoiceId: r.invoice_id,
  ownerId: r.owner_id, amount: r.amount, paymentDate: r.payment_date, method: r.payment_method,
  payfastPaymentId: r.payfast_payment_id, status: r.status, notes: r.notes, createdAt: r.created_at,
});
const mapMaintenance = (r: any): MaintenanceRequest => ({
  id: r.id, propertyId: r.property_id, leaseId: r.lease_id, tenantId: r.tenant_id,
  ownerId: r.owner_id, title: r.title, description: r.description || '',
  status: r.status, priority: r.priority, images: r.images,
  resolutionNote: r.resolution_note ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapStatementUpload = (r: any): StatementUpload => ({
  id: r.id, propertyId: r.property_id, ownerId: r.owner_id, filePath: r.file_path,
  fileName: r.file_name, extractedData: r.extracted_data, extractionStatus: r.extraction_status,
  propertyCostId: r.property_cost_id, uploadedAt: r.uploaded_at,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [propertyCosts, setPropertyCosts] = useState<PropertyCost[]>([]);
  const [utilityBreakdowns, setUtilityBreakdowns] = useState<UtilityBreakdown[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [statementUploads, setStatementUploads] = useState<StatementUpload[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Load all data for logged-in user ──────────────────────
  const refreshData = useCallback(async () => {
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    if (!sbUser) return;
    setDataLoading(true);
    try {
      const [
        { data: props }, { data: tens }, { data: leas }, { data: costs },
        { data: bds }, { data: invs }, { data: pays }, { data: maint }, { data: stmts }
      ] = await Promise.all([
        supabase.from('properties').select('*').eq('owner_id', sbUser.id).order('created_at', { ascending: false }),
        supabase.from('tenants').select('*').eq('owner_id', sbUser.id).order('created_at', { ascending: false }),
        supabase.from('leases').select('*').eq('owner_id', sbUser.id).order('created_at', { ascending: false }),
        supabase.from('property_costs').select('*').eq('owner_id', sbUser.id).order('year', { ascending: false }),
        supabase.from('utility_breakdowns').select('*'),
        supabase.from('invoices').select('*').eq('owner_id', sbUser.id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('owner_id', sbUser.id).order('payment_date', { ascending: false }),
        supabase.from('maintenance_requests').select('*').eq('owner_id', sbUser.id).order('created_at', { ascending: false }),
        supabase.from('statement_uploads').select('*').eq('owner_id', sbUser.id).order('uploaded_at', { ascending: false }),
      ]);
      if (props) setProperties(props.map(mapProperty));
      if (tens) setTenants(tens.map(mapTenant));
      if (leas) setLeases(leas.map(mapLease));
      if (costs) setPropertyCosts(costs.map(mapPropertyCost));
      if (bds) setUtilityBreakdowns(bds.map(mapUtilityBreakdown));
      if (pays) setPayments(pays.map(mapPayment));
      if (maint) setMaintenanceRequests(maint.map(mapMaintenance));
      if (stmts) setStatementUploads(stmts.map(mapStatementUpload));

      // ── Auto-detect overdue and partial statuses ───────────
      if (invs && pays) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build a map of totalPaid per invoice from verified payments
        const paidMap: Record<string, number> = {};
        pays.filter((p: any) => p.status === 'verified' && p.invoice_id).forEach((p: any) => {
          paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + p.amount;
        });

        const overdueIds: string[] = [];
        const partialIds: string[] = [];

        const mappedInvs = invs.map((r: any) => {
          const inv = mapInvoice(r);
          const totalPaid = paidMap[inv.id] || 0;

          // Already fully paid — status stays paid regardless of date
          if (inv.status === 'paid') return inv;

          // Has partial payments
          if (totalPaid > 0 && totalPaid < inv.totalAmount) {
            if (inv.status !== 'partial') partialIds.push(inv.id);
            return { ...inv, status: 'partial' as const };
          }

          // Past due date and still unpaid — mark overdue
          if ((inv.status === 'sent' || inv.status === 'partial') && inv.dueDate) {
            const due = new Date(inv.dueDate);
            due.setHours(0, 0, 0, 0);
            if (due < today) {
              overdueIds.push(inv.id);
              return { ...inv, status: 'overdue' as const };
            }
          }

          return inv;
        });

        setInvoices(mappedInvs);

        // Write status changes back to Supabase in the background
        if (overdueIds.length > 0) {
          supabase.from('invoices').update({ status: 'overdue' }).in('id', overdueIds).then(() => {});
        }
        if (partialIds.length > 0) {
          supabase.from('invoices').update({ status: 'partial' }).in('id', partialIds).then(() => {});
        }
      }
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── Detect role from DB ───────────────────────────────────
  // Returns null if no role row exists (e.g. accept-invite pre-link).
  // The default 'landlord' fallback was wrong: it caused tenants on accept-invite
  // to flash the landlord portal while their role row was being written.
  const detectRole = useCallback(async (sbUser: any): Promise<'landlord' | 'tenant' | null> => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', sbUser.id)
      .maybeSingle();
    return (data?.role as 'landlord' | 'tenant') ?? null;
  }, []);

  // ── Auth state listener ───────────────────────────────────
  useEffect(() => {
    // Skip data loading on accept-invite — AcceptInvitePage owns that flow.
    // This prevents the AppProvider from racing with the linking process.
    const isAcceptInvite = typeof window !== 'undefined' &&
      window.location.pathname.includes('/accept-invite');

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user && !isAcceptInvite) {
        const role = await detectRole(s.user);
        if (role) {
          setUser({ id: s.user.id, name: s.user.user_metadata?.name || s.user.email || '', email: s.user.email || '', role, createdAt: s.user.created_at });
          if (role === 'landlord') refreshData();
        }
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      // On accept-invite, never set the user from the magic-link session —
      // AcceptInvitePage will handle linking and the final redirect.
      const stillOnAcceptInvite = typeof window !== 'undefined' &&
        window.location.pathname.includes('/accept-invite');
      if (stillOnAcceptInvite) return;

      if (s?.user) {
        const role = await detectRole(s.user);
        if (role) {
          setUser({ id: s.user.id, name: s.user.user_metadata?.name || s.user.email || '', email: s.user.email || '', role, createdAt: s.user.created_at });
          if (role === 'landlord') refreshData();
        }
      } else {
        setUser(null);
        setProperties([]); setTenants([]); setLeases([]);
        setPropertyCosts([]); setUtilityBreakdowns([]); setInvoices([]);
        setPayments([]); setMaintenanceRequests([]); setStatementUploads([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshData, detectRole]);

  // ── Auth actions ──────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    return { error: error?.message || null };
  }, []);

  // ── Properties ────────────────────────────────────────────
  const addProperty = useCallback(async (data: Omit<Property, 'id' | 'ownerId' | 'createdAt'>): Promise<Property> => {
    const { data: row, error } = await supabase.from('properties').insert({
      owner_id: user!.id, name: data.name, address: data.address,
      city: data.city, province: data.province, rent_amount: data.rentAmount,
      unit_number: data.unitNumber || null,
      erf_size: data.erfSize || null,
    }).select().single();
    if (error) throw error;
    const p = mapProperty(row);
    setProperties(prev => [p, ...prev]);
    return p;
  }, [user]);

  const updateProperty = useCallback(async (id: string, data: Partial<Property>) => {
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.address !== undefined) update.address = data.address;
    if (data.city !== undefined) update.city = data.city;
    if (data.province !== undefined) update.province = data.province;
    if (data.rentAmount !== undefined) update.rent_amount = data.rentAmount;
    if (data.unitNumber !== undefined) update.unit_number = data.unitNumber || null;
    if (data.erfSize !== undefined) update.erf_size = data.erfSize || null;
    const { error } = await supabase.from('properties').update(update).eq('id', id);
    if (error) throw error;
    setProperties(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const deleteProperty = useCallback(async (id: string) => {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw error;
    setProperties(prev => prev.filter(p => p.id !== id));
    setLeases(prev => prev.filter(l => l.propertyId !== id));
    setInvoices(prev => prev.filter(i => i.propertyId !== id));
    setPayments(prev => prev.filter(p => p.propertyId !== id));
    setPropertyCosts(prev => prev.filter(c => c.propertyId !== id));
    setMaintenanceRequests(prev => prev.filter(m => m.propertyId !== id));
  }, []);

  // ── Tenants ───────────────────────────────────────────────
  const addTenant = useCallback(async (data: Omit<Tenant, 'id' | 'ownerId' | 'createdAt' | 'inviteStatus'>): Promise<Tenant> => {
    const { data: row, error } = await supabase.from('tenants').insert({
      owner_id: user!.id, name: data.name, email: data.email, phone: data.phone,
    }).select().single();
    if (error) throw error;
    const t = mapTenant(row);
    setTenants(prev => [t, ...prev]);
    return t;
  }, [user]);

  const updateTenant = useCallback(async (id: string, data: Partial<Tenant>) => {
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.inviteStatus !== undefined) update.invite_status = data.inviteStatus;
    const { error } = await supabase.from('tenants').update(update).eq('id', id);
    if (error) throw error;
    setTenants(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, []);

  const inviteTenant = useCallback(async (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) throw new Error('Tenant not found');

    // signInWithOtp sends a magic link email via your configured SMTP.
    // The tenant clicks the link, lands on /app/accept-invite, Supabase
    // authenticates them via the token, and we link their account there.
    const redirectTo = `${APP_URL}/app/accept-invite?tenant_id=${tenantId}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: tenant.email,
      options: {
        shouldCreateUser: true,
        data: { name: tenant.name, tenant_id: tenantId, role: 'tenant' },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) throw error;

    await supabase.from('tenants')
      .update({ invite_status: 'pending' })
      .eq('id', tenantId);

    setTenants(prev =>
      prev.map(t => t.id === tenantId ? { ...t, inviteStatus: 'pending' as const } : t)
    );
  }, [tenants]);

  // ── Leases ────────────────────────────────────────────────
  const addLease = useCallback(async (data: Omit<Lease, 'id' | 'ownerId' | 'createdAt'>): Promise<Lease> => {
    const { data: row, error } = await supabase.from('leases').insert({
      property_id: data.propertyId, tenant_id: data.tenantId, owner_id: user!.id,
      start_date: data.startDate, end_date: data.endDate || null,
      rent_amount: data.rentAmount, deposit_paid: data.depositPaid, status: data.status,
    }).select().single();
    if (error) throw error;
    const l = mapLease(row);
    setLeases(prev => [l, ...prev]);
    return l;
  }, [user]);

  const updateLease = useCallback(async (id: string, data: Partial<Lease>) => {
    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.endDate !== undefined) update.end_date = data.endDate;
    if (data.rentAmount !== undefined) update.rent_amount = data.rentAmount;
    if (data.depositPaid !== undefined) update.deposit_paid = data.depositPaid;
    const { error } = await supabase.from('leases').update(update).eq('id', id);
    if (error) throw error;
    setLeases(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  }, []);

  const endLease = useCallback(async (id: string) => {
    const { error } = await supabase.from('leases').update({ status: 'ended', end_date: today() }).eq('id', id);
    if (error) throw error;
    setLeases(prev => prev.map(l => l.id === id ? { ...l, status: 'ended' as const, endDate: today() } : l));
  }, []);

  // ── Property Costs ────────────────────────────────────────
  const addPropertyCost = useCallback(async (data: Omit<PropertyCost, 'id' | 'ownerId' | 'createdAt' | 'totalAmount'>): Promise<PropertyCost> => {
    const { data: row, error } = await supabase.from('property_costs').insert({
      property_id: data.propertyId,
      owner_id: user!.id,
      month: data.month,
      year: data.year,
      notes: data.notes || null,
      total_amount: 0,
      // Legacy columns — made nullable by fix-property-costs.sql
      // Supplying defaults here as a safety net in case migration hasn't run yet
      category: 'running_costs',
      amount: 0,
      cost_date: new Date(data.year, data.month - 1, 1).toISOString().split('T')[0],
    }).select().single();
    if (error) throw error;
    const c = mapPropertyCost(row);
    setPropertyCosts(prev => [c, ...prev]);
    return c;
  }, [user]);

  const updatePropertyCost = useCallback(async (id: string, data: Partial<PropertyCost>) => {
    const update: any = {};
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.totalAmount !== undefined) update.total_amount = data.totalAmount;
    const { error } = await supabase.from('property_costs').update(update).eq('id', id);
    if (error) throw error;
    setPropertyCosts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deletePropertyCost = useCallback(async (id: string) => {
    const { error } = await supabase.from('property_costs').delete().eq('id', id);
    if (error) throw error;
    setPropertyCosts(prev => prev.filter(c => c.id !== id));
    setUtilityBreakdowns(prev => prev.filter(b => b.propertyCostId !== id));
  }, []);

  // ── Utility Breakdowns ────────────────────────────────────
  const addUtilityBreakdown = useCallback(async (data: Omit<UtilityBreakdown, 'id' | 'createdAt'>): Promise<UtilityBreakdown> => {
    const { data: row, error } = await supabase.from('utility_breakdowns').insert({
      property_cost_id: data.propertyCostId, label: data.label,
      amount: data.amount, is_recoverable: data.isRecoverable,
      is_recurring: data.isRecurring ?? false,
    }).select().single();
    if (error) throw error;
    const b = mapUtilityBreakdown(row);
    setUtilityBreakdowns(prev => [...prev, b]);
    // Recalculate total
    const allBds = [...utilityBreakdowns.filter(x => x.propertyCostId === data.propertyCostId), b];
    const newTotal = allBds.reduce((s, x) => s + x.amount, 0);
    await supabase.from('property_costs').update({ total_amount: newTotal }).eq('id', data.propertyCostId);
    setPropertyCosts(prev => prev.map(c => c.id === data.propertyCostId ? { ...c, totalAmount: newTotal } : c));
    return b;
  }, [utilityBreakdowns]);

  const updateUtilityBreakdown = useCallback(async (id: string, data: Partial<UtilityBreakdown>) => {
    const update: any = {};
    if (data.label !== undefined) update.label = data.label;
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.isRecoverable !== undefined) update.is_recoverable = data.isRecoverable;
    if (data.isRecurring !== undefined) update.is_recurring = data.isRecurring;
    const { error } = await supabase.from('utility_breakdowns').update(update).eq('id', id);
    if (error) throw error;
    setUtilityBreakdowns(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...data } : b);
      const changed = updated.find(b => b.id === id)!;
      const newTotal = updated.filter(b => b.propertyCostId === changed.propertyCostId).reduce((s, b) => s + b.amount, 0);
      supabase.from('property_costs').update({ total_amount: newTotal }).eq('id', changed.propertyCostId);
      setPropertyCosts(costs => costs.map(c => c.id === changed.propertyCostId ? { ...c, totalAmount: newTotal } : c));
      return updated;
    });
  }, []);

  const deleteUtilityBreakdown = useCallback(async (id: string) => {
    const bd = utilityBreakdowns.find(b => b.id === id);
    const { error } = await supabase.from('utility_breakdowns').delete().eq('id', id);
    if (error) throw error;
    setUtilityBreakdowns(prev => {
      const updated = prev.filter(b => b.id !== id);
      if (bd) {
        const newTotal = updated.filter(b => b.propertyCostId === bd.propertyCostId).reduce((s, b) => s + b.amount, 0);
        supabase.from('property_costs').update({ total_amount: newTotal }).eq('id', bd.propertyCostId);
        setPropertyCosts(costs => costs.map(c => c.id === bd.propertyCostId ? { ...c, totalAmount: newTotal } : c));
      }
      return updated;
    });
  }, [utilityBreakdowns]);

  // ── Invoices ──────────────────────────────────────────────
  const addInvoice = useCallback(async (data: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'invoiceNumber'>): Promise<Invoice> => {
    const count = invoices.length + 1;
    const invoiceNumber = `INV-${data.year}-${String(count).padStart(3, '0')}`;
    const { data: row, error } = await supabase.from('invoices').insert({
      property_id: data.propertyId, lease_id: data.leaseId, owner_id: user!.id,
      invoice_number: invoiceNumber, month: data.month, year: data.year,
      due_date: data.dueDate, invoice_date: data.dueDate, line_items: data.lineItems,
      total_amount: data.totalAmount, status: data.status,
    }).select().single();
    if (error) throw error;
    const inv = mapInvoice(row);
    setInvoices(prev => [inv, ...prev]);
    return inv;
  }, [user, invoices]);

  const updateInvoice = useCallback(async (id: string, data: Partial<Invoice>) => {
    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.dueDate !== undefined) update.due_date = data.dueDate;
    if (data.lineItems !== undefined) update.line_items = data.lineItems;
    if (data.totalAmount !== undefined) update.total_amount = data.totalAmount;
    const { error } = await supabase.from('invoices').update(update).eq('id', id);
    if (error) throw error;
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  }, []);

  const deleteInvoice = useCallback(async (id: string) => {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    setInvoices(prev => prev.filter(i => i.id !== id));
  }, []);

  // ── Payments ──────────────────────────────────────────────
  const addPayment = useCallback(async (data: Omit<Payment, 'id' | 'ownerId' | 'createdAt'>): Promise<Payment> => {
    const { data: row, error } = await supabase.from('payments').insert({
      property_id: data.propertyId, lease_id: data.leaseId || null,
      invoice_id: data.invoiceId || null, owner_id: user!.id,
      amount: data.amount, payment_date: data.paymentDate,
      payment_method: data.method, status: data.status, notes: data.notes || null,
    }).select().single();
    if (error) throw error;
    const p = mapPayment(row);
    setPayments(prev => [p, ...prev]);

    // ── Smart invoice status after payment ─────────────────
    if (data.invoiceId) {
      setInvoices(prev => {
        const inv = prev.find(i => i.id === data.invoiceId);
        if (!inv) return prev;

        // Sum all existing verified payments for this invoice + this new one
        const existingPaid = prev
          .filter(i => i.id === data.invoiceId)
          .reduce((_, __) => 0, 0); // placeholder — we calculate below

        // We need access to the payments state here; use a callback approach
        return prev; // will be updated in the next block
      });

      // Get all payments for this invoice after insert
      const { data: invPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', data.invoiceId)
        .eq('status', 'verified');

      const totalPaid = (invPayments || []).reduce((s: number, p: any) => s + p.amount, 0);
      const inv = invoices.find(i => i.id === data.invoiceId);

      if (inv) {
        let newStatus: Invoice['status'];
        if (totalPaid >= inv.totalAmount) {
          newStatus = 'paid';
        } else {
          // Partial — keep overdue if already past due date
          const due = new Date(inv.dueDate);
          due.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          newStatus = due < today ? 'overdue' : 'partial';
        }
        await supabase.from('invoices').update({ status: newStatus }).eq('id', data.invoiceId);
        setInvoices(prev => prev.map(i => i.id === data.invoiceId ? { ...i, status: newStatus } : i));
      }
    }

    return p;
  }, [user, invoices]);

  // ── Maintenance ───────────────────────────────────────────
  const addMaintenanceRequest = useCallback(async (data: Omit<MaintenanceRequest, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<MaintenanceRequest> => {
    const { data: row, error } = await supabase.from('maintenance_requests').insert({
      property_id: data.propertyId, lease_id: data.leaseId || null,
      tenant_id: data.tenantId || null, owner_id: user!.id,
      title: data.title, description: data.description,
      status: data.status, priority: data.priority,
    }).select().single();
    if (error) throw error;
    const r = mapMaintenance(row);
    setMaintenanceRequests(prev => [r, ...prev]);
    return r;
  }, [user]);

  const updateMaintenanceRequest = useCallback(async (id: string, data: Partial<MaintenanceRequest>) => {
    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.priority !== undefined) update.priority = data.priority;
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.resolutionNote !== undefined) update.resolution_note = data.resolutionNote;
    const { error } = await supabase.from('maintenance_requests').update(update).eq('id', id);
    if (error) throw error;
    setMaintenanceRequests(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  }, []);

  // ── Statement Uploads ─────────────────────────────────────
  const addStatementUpload = useCallback(async (data: Omit<StatementUpload, 'id' | 'ownerId' | 'uploadedAt' | 'extractionStatus'>): Promise<StatementUpload> => {
    const { data: row, error } = await supabase.from('statement_uploads').insert({
      property_id: data.propertyId, owner_id: user!.id,
      file_path: data.filePath, file_name: data.fileName,
      extraction_status: 'pending',
    }).select().single();
    if (error) throw error;
    const s = mapStatementUpload(row);
    setStatementUploads(prev => [s, ...prev]);
    return s;
  }, [user]);

  const updateStatementUpload = useCallback(async (id: string, data: Partial<StatementUpload>) => {
    const update: any = {};
    if (data.extractionStatus !== undefined) update.extraction_status = data.extractionStatus;
    if (data.extractedData !== undefined) update.extracted_data = data.extractedData;
    if (data.propertyCostId !== undefined) update.property_cost_id = data.propertyCostId;
    const { error } = await supabase.from('statement_uploads').update(update).eq('id', id);
    if (error) throw error;
    setStatementUploads(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const value: AppContextType = {
    user, session, authLoading, dataLoading,
    properties, tenants, leases, propertyCosts, utilityBreakdowns,
    invoices, payments, maintenanceRequests, statementUploads,
    toasts, sidebarOpen,
    login, logout, signup,
    addProperty, updateProperty, deleteProperty,
    addTenant, updateTenant, inviteTenant,
    addLease, updateLease, endLease,
    addPropertyCost, updatePropertyCost, deletePropertyCost,
    addUtilityBreakdown, updateUtilityBreakdown, deleteUtilityBreakdown,
    addInvoice, updateInvoice, deleteInvoice,
    addPayment,
    addMaintenanceRequest, updateMaintenanceRequest,
    addStatementUpload, updateStatementUpload,
    showToast, dismissToast, setSidebarOpen,
    refreshData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

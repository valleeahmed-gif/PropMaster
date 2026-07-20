-- ============================================================
-- Reconcile the restored (pre-pause) database with the schema
-- the app expects. Applied to cghiodbvbggizghxuvna 2026-07-20.
--
-- Context: the project was paused; after restore the pre-pause
-- schema (propmaster-reset.sql + alter scripts) came back, so
-- the "create table if not exists" statements in the initial
-- schema migration were no-ops. This migration closes the gaps.
-- ============================================================

-- 1. property_costs: the client still supplies legacy columns on insert.
alter table public.property_costs add column if not exists category  text;
alter table public.property_costs add column if not exists amount    numeric;
alter table public.property_costs add column if not exists cost_date date;

-- 2. payments.lease_id: app records payments without a lease in some paths.
alter table public.payments alter column lease_id drop not null;

-- 3. SECURITY: remove the open read policy that exposed the entire tenants
--    table (incl. bank details) to any authenticated user. The accept-invite
--    flow now uses the get_invite_info()/accept_invite() SECURITY DEFINER RPCs.
drop policy if exists "accept invite read" on public.tenants;

-- 4. Remove the old duplicate policy set (superseded by the identical
--    policies created in initial_schema). Keeping one set only.
drop policy if exists "own role"                     on public.user_roles;
drop policy if exists "landlord owns properties"     on public.properties;
drop policy if exists "tenant views leased property" on public.properties;
drop policy if exists "landlord owns tenants"        on public.tenants;
drop policy if exists "tenant views own record"      on public.tenants;
drop policy if exists "landlord owns leases"         on public.leases;
drop policy if exists "tenant views own lease"       on public.leases;
drop policy if exists "landlord owns costs"          on public.property_costs;
drop policy if exists "landlord owns breakdowns"     on public.utility_breakdowns;
drop policy if exists "landlord owns invoices"       on public.invoices;
drop policy if exists "tenant views own invoices"    on public.invoices;
drop policy if exists "landlord owns payments"       on public.payments;
drop policy if exists "tenant views own payments"    on public.payments;
drop policy if exists "landlord owns maintenance"    on public.maintenance_requests;
drop policy if exists "tenant views own maintenance" on public.maintenance_requests;
drop policy if exists "tenant submits maintenance"   on public.maintenance_requests;
drop policy if exists "landlord owns uploads"        on public.statement_uploads;
-- (keep "landlord owns invoice items" — only policy on legacy invoice_items)

-- 5. Backfill roles for existing users that have none (they were stuck at
--    login: role detection returned null). Default to landlord, same as the
--    signup trigger; accept_invite() flips invitees to tenant when they link.
insert into public.user_roles (user_id, role)
select u.id, 'landlord'
from auth.users u
where not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
on conflict (user_id) do nothing;

-- 6. Uniqueness guards skipped by the no-op create-table statements.
create unique index if not exists invoices_owner_number_key
  on public.invoices (owner_id, invoice_number);

create unique index if not exists leases_one_active_per_property
  on public.leases (property_id) where status = 'active';

-- 7. Drop the unused has_role() helper (nothing references it).
drop function if exists public.has_role(uuid, text);

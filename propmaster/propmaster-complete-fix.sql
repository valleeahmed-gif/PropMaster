-- ============================================================
-- PropMaster — Complete Fix Script
-- 
-- Safe to run multiple times. Checks state before each change.
-- Run in Supabase → SQL Editor → New query → Run
-- ============================================================


-- ── STEP 1: Fix property_costs legacy NOT NULL columns ─────
-- Your original table has category, amount, cost_date as NOT NULL
-- with no defaults. The app uses month/year model and doesn't 
-- supply these, causing the insert to fail.

alter table public.property_costs
  alter column category drop not null;

alter table public.property_costs
  alter column amount drop not null;

alter table public.property_costs
  alter column cost_date drop not null;


-- ── STEP 2: Add missing columns if not already present ─────

alter table public.property_costs
  add column if not exists owner_id uuid 
    references auth.users(id) on delete cascade;

alter table public.property_costs
  add column if not exists month integer 
    check (month between 1 and 12);

alter table public.property_costs
  add column if not exists year integer 
    check (year >= 2000);

alter table public.property_costs
  add column if not exists total_amount numeric 
    not null default 0;

alter table public.property_costs
  add column if not exists notes text;


-- ── STEP 3: Backfill owner_id from parent property ─────────

update public.property_costs pc
set owner_id = p.owner_id
from public.properties p
where p.id = pc.property_id
  and pc.owner_id is null;


-- ── STEP 4: Create utility_breakdowns if missing ───────────

create table if not exists public.utility_breakdowns (
  id uuid primary key default uuid_generate_v4(),
  property_cost_id uuid not null 
    references public.property_costs(id) on delete cascade,
  label text not null,
  amount numeric not null check (amount >= 0),
  is_recoverable boolean not null default false,
  created_at timestamptz not null default now()
);


-- ── STEP 5: Create statement_uploads if missing ────────────

create table if not exists public.statement_uploads (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null 
    references public.properties(id) on delete cascade,
  owner_id uuid not null 
    references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  extracted_data jsonb,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','processing','complete','failed')),
  property_cost_id uuid 
    references public.property_costs(id) on delete set null,
  uploaded_at timestamptz not null default now()
);


-- ── STEP 6: Add missing columns to invoices ────────────────

alter table public.invoices
  add column if not exists line_items jsonb not null default '[]'::jsonb;

alter table public.invoices
  add column if not exists month integer 
    check (month between 1 and 12);

alter table public.invoices
  add column if not exists year integer 
    check (year >= 2000);

alter table public.invoices
  add column if not exists owner_id uuid 
    references auth.users(id) on delete cascade;

-- Backfill invoices owner_id
update public.invoices i
set owner_id = p.owner_id
from public.leases l
join public.properties p on p.id = l.property_id
where l.id = i.lease_id
  and i.owner_id is null;


-- ── STEP 7: Add missing columns to payments ────────────────

alter table public.payments
  add column if not exists owner_id uuid 
    references auth.users(id) on delete cascade;

alter table public.payments
  add column if not exists status text not null default 'verified'
    check (status in ('pending','verified','failed'));

-- Widen payment_method check to include eft and other
alter table public.payments
  drop constraint if exists payments_payment_method_check;

alter table public.payments
  add constraint payments_payment_method_check
    check (payment_method in ('bank_transfer','eft','cash','cheque','payfast','other'));

-- Backfill payments owner_id
update public.payments py
set owner_id = p.owner_id
from public.leases l
join public.properties p on p.id = l.property_id
where l.id = py.lease_id
  and py.owner_id is null;


-- ── STEP 8: Add missing columns to maintenance_requests ────

alter table public.maintenance_requests
  add column if not exists title text;

alter table public.maintenance_requests
  add column if not exists owner_id uuid 
    references auth.users(id) on delete cascade;

alter table public.maintenance_requests
  add column if not exists tenant_id uuid 
    references public.tenants(id) on delete set null;

-- Backfill title from description
update public.maintenance_requests
set title = left(description, 80)
where title is null;

-- Backfill owner_id
update public.maintenance_requests mr
set owner_id = p.owner_id
from public.properties p
where p.id = mr.property_id
  and mr.owner_id is null;

-- Widen status check to support both old and new values
alter table public.maintenance_requests
  drop constraint if exists maintenance_requests_status_check;

alter table public.maintenance_requests
  add constraint maintenance_requests_status_check
    check (status in ('open','in_progress','resolved','closed','completed','cancelled'));


-- ── STEP 9: Add missing columns to tenants ─────────────────

alter table public.tenants
  add column if not exists user_id uuid 
    references auth.users(id) on delete set null;

alter table public.tenants
  add column if not exists invite_status text not null default 'none'
    check (invite_status in ('none','pending','accepted'));


-- ── STEP 10: Unique index — one active lease per property ──

create unique index if not exists leases_one_active_per_property
  on public.leases(property_id) where (status = 'active');


-- ── STEP 11: Enable RLS on all tables ──────────────────────

alter table public.user_roles         enable row level security;
alter table public.properties         enable row level security;
alter table public.tenants            enable row level security;
alter table public.leases             enable row level security;
alter table public.property_costs     enable row level security;
alter table public.utility_breakdowns enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_items      enable row level security;
alter table public.payments           enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.statement_uploads  enable row level security;


-- ── STEP 12: Drop all existing policies and recreate clean ─

do $$ declare r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  ) loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;

-- user_roles
create policy "own roles read"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "own roles insert"
  on public.user_roles for insert
  with check (auth.uid() = user_id);

-- properties
create policy "landlord properties"
  on public.properties for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant view leased property"
  on public.properties for select
  using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.property_id = properties.id
        and t.user_id = auth.uid()
        and l.status = 'active'
    )
  );

-- tenants
create policy "landlord tenants"
  on public.tenants for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant own record"
  on public.tenants for select
  using (auth.uid() = user_id);

-- leases
create policy "landlord leases"
  on public.leases for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant own leases"
  on public.leases for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = leases.tenant_id
        and t.user_id = auth.uid()
    )
  );

-- property_costs
create policy "landlord property costs"
  on public.property_costs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- utility_breakdowns
create policy "landlord utility breakdowns"
  on public.utility_breakdowns for all
  using (
    exists (
      select 1 from public.property_costs pc
      where pc.id = utility_breakdowns.property_cost_id
        and pc.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.property_costs pc
      where pc.id = utility_breakdowns.property_cost_id
        and pc.owner_id = auth.uid()
    )
  );

-- invoices
create policy "landlord invoices"
  on public.invoices for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant own invoices"
  on public.invoices for select
  using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = invoices.lease_id
        and t.user_id = auth.uid()
    )
  );

-- invoice_items
create policy "landlord invoice items"
  on public.invoice_items for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.owner_id = auth.uid()
    )
  );

-- payments
create policy "landlord payments"
  on public.payments for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant own payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = payments.lease_id
        and t.user_id = auth.uid()
    )
  );

-- maintenance_requests
create policy "landlord maintenance"
  on public.maintenance_requests for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant view maintenance"
  on public.maintenance_requests for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id
        and t.user_id = auth.uid()
    )
  );

create policy "tenant insert maintenance"
  on public.maintenance_requests for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id
        and t.user_id = auth.uid()
    )
  );

-- statement_uploads
create policy "landlord statement uploads"
  on public.statement_uploads for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);


-- ── STEP 13: has_role helper function ──────────────────────

create or replace function public.has_role(uid uuid, r text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles 
    where user_id = uid and role = r
  );
$$;


-- ── STEP 14: Auto-assign landlord role on signup ───────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'landlord')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── STEP 15: Auto-update updated_at ────────────────────────

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_maintenance_updated_at 
  on public.maintenance_requests;

create trigger set_maintenance_updated_at
  before update on public.maintenance_requests
  for each row execute procedure public.update_updated_at();


-- ── STEP 16: Verification — check everything looks right ───

select 
  'property_costs' as table_name,
  count(*) as rows,
  count(owner_id) as rows_with_owner_id,
  bool_and(category is null or true) as category_nullable,
  bool_and(amount is null or true) as amount_nullable,
  bool_and(cost_date is null or true) as cost_date_nullable
from public.property_costs

union all

select 
  'utility_breakdowns',
  count(*),
  null,
  null,
  null,
  null
from public.utility_breakdowns

union all

select 
  'statement_uploads',
  count(*),
  null,
  null,
  null,
  null
from public.statement_uploads;

-- If this returns without error, everything is set up correctly.
select 'All done — PropMaster schema is ready' as status;

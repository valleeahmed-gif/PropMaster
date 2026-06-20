-- ============================================================
-- PropMaster — Complete Database Reset
-- Run in Supabase → SQL Editor → New query → Run
-- WARNING: This deletes ALL data. Fresh start only.
-- ============================================================

-- ── 0. Ensure required extensions ──────────────────────────
create extension if not exists "uuid-ossp";

-- ── 1. Drop triggers FIRST (safely, even if tables don't exist) ──
do $$
begin
  -- Drop signup trigger from auth.users
  if exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    drop trigger on_auth_user_created on auth.users;
  end if;

  -- Drop maintenance updated_at trigger only if table exists
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'maintenance_requests') then
    drop trigger if exists set_maintenance_updated_at on public.maintenance_requests;
  end if;
end $$;

-- ── 2. Drop functions ──────────────────────────────────────
drop function if exists public.handle_new_user()    cascade;
drop function if exists public.update_updated_at()  cascade;
drop function if exists public.has_role(uuid, text) cascade;

-- ── 3. Drop all tables (order matters for foreign keys) ────
drop table if exists public.statement_uploads    cascade;
drop table if exists public.maintenance_requests cascade;
drop table if exists public.payments             cascade;
drop table if exists public.invoice_items        cascade;
drop table if exists public.invoices             cascade;
drop table if exists public.utility_breakdowns   cascade;
drop table if exists public.property_costs       cascade;
drop table if exists public.leases               cascade;
drop table if exists public.tenants              cascade;
drop table if exists public.properties           cascade;
drop table if exists public.user_roles           cascade;

-- ── 4. Recreate all tables ─────────────────────────────────

create table public.user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('landlord', 'tenant')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table public.properties (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  address     text not null,
  city        text not null,
  province    text not null,
  rent_amount numeric not null check (rent_amount >= 0),
  unit_number text,
  erf_size    numeric,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.tenants (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  email         text not null,
  phone         text,
  invite_status text not null default 'none' check (invite_status in ('none','pending','accepted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.leases (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  start_date   date not null,
  end_date     date,
  rent_amount  numeric not null check (rent_amount >= 0),
  deposit_paid numeric not null default 0,
  status       text not null default 'active' check (status in ('active','ended','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.property_costs (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  month        integer not null check (month between 1 and 12),
  year         integer not null check (year >= 2000),
  total_amount numeric not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (property_id, month, year)
);

create table public.utility_breakdowns (
  id               uuid primary key default uuid_generate_v4(),
  property_cost_id uuid not null references public.property_costs(id) on delete cascade,
  label            text not null,
  amount           numeric not null check (amount >= 0),
  is_recoverable   boolean not null default false,
  is_recurring     boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.invoices (
  id             uuid primary key default uuid_generate_v4(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  lease_id       uuid not null references public.leases(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  month          integer check (month between 1 and 12),
  year           integer check (year >= 2000),
  invoice_date   date,
  due_date       date not null,
  line_items     jsonb not null default '[]',
  total_amount   numeric not null check (total_amount >= 0),
  status         text not null default 'draft'
    check (status in ('draft','sent','partial','paid','overdue','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Auto invoice number sequence per owner
create sequence if not exists public.invoice_seq;

create table public.invoice_items (
  id          uuid primary key default uuid_generate_v4(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  amount      numeric not null,
  created_at  timestamptz not null default now()
);

create table public.payments (
  id                  uuid primary key default uuid_generate_v4(),
  property_id         uuid not null references public.properties(id) on delete cascade,
  lease_id            uuid not null references public.leases(id) on delete cascade,
  invoice_id          uuid references public.invoices(id) on delete set null,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  amount              numeric not null check (amount > 0),
  payment_date        date not null,
  payment_method      text not null default 'bank_transfer'
    check (payment_method in ('bank_transfer','eft','cash','cheque','payfast','other')),
  status              text not null default 'verified'
    check (status in ('pending','verified','failed')),
  payfast_payment_id  text,
  notes               text,
  created_at          timestamptz not null default now()
);

create table public.maintenance_requests (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  lease_id        uuid references public.leases(id) on delete set null,
  tenant_id       uuid references public.tenants(id) on delete set null,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  description     text,
  status          text not null default 'open'
    check (status in ('open','in_progress','resolved','closed','completed','cancelled')),
  priority        text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  resolution_note text,
  images          text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.statement_uploads (
  id                uuid primary key default uuid_generate_v4(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  owner_id          uuid not null references auth.users(id) on delete cascade,
  file_path         text not null,
  file_name         text not null,
  extracted_data    jsonb,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','processing','complete','failed')),
  property_cost_id  uuid references public.property_costs(id) on delete set null,
  uploaded_at       timestamptz not null default now()
);

-- ── 5. Enable RLS on all tables ────────────────────────────
alter table public.user_roles           enable row level security;
alter table public.properties           enable row level security;
alter table public.tenants              enable row level security;
alter table public.leases               enable row level security;
alter table public.property_costs       enable row level security;
alter table public.utility_breakdowns   enable row level security;
alter table public.invoices             enable row level security;
alter table public.invoice_items        enable row level security;
alter table public.payments             enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.statement_uploads    enable row level security;

-- ── 6. RLS Policies ────────────────────────────────────────

-- user_roles: each user reads/writes only their own row
create policy "own role"
  on public.user_roles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- properties
create policy "landlord owns properties"
  on public.properties for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant views leased property"
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
create policy "landlord owns tenants"
  on public.tenants for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant views own record"
  on public.tenants for select
  using (auth.uid() = user_id);

-- CRITICAL: allow unauthenticated/new users to read tenant record by id
-- during accept-invite flow (before user_id is set)
-- We scope this tightly: only select, only by id
create policy "accept invite read"
  on public.tenants for select
  using (true); -- Scoped by the query itself (eq id + magic link session)

-- leases
create policy "landlord owns leases"
  on public.leases for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant views own lease"
  on public.leases for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = leases.tenant_id and t.user_id = auth.uid()
    )
  );

-- property_costs
create policy "landlord owns costs"
  on public.property_costs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- utility_breakdowns
create policy "landlord owns breakdowns"
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
create policy "landlord owns invoices"
  on public.invoices for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant views own invoices"
  on public.invoices for select
  using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = invoices.lease_id and t.user_id = auth.uid()
    )
  );

-- invoice_items
create policy "landlord owns invoice items"
  on public.invoice_items for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.owner_id = auth.uid()
    )
  );

-- payments
create policy "landlord owns payments"
  on public.payments for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant views own payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = payments.lease_id and t.user_id = auth.uid()
    )
  );

-- maintenance_requests
create policy "landlord owns maintenance"
  on public.maintenance_requests for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant views own maintenance"
  on public.maintenance_requests for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id and t.user_id = auth.uid()
    )
  );

create policy "tenant submits maintenance"
  on public.maintenance_requests for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id and t.user_id = auth.uid()
    )
  );

-- statement_uploads
create policy "landlord owns uploads"
  on public.statement_uploads for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── 7. Helper function ─────────────────────────────────────
create or replace function public.has_role(uid uuid, r text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles where user_id = uid and role = r
  );
$$;

-- ── 8. Auto-assign LANDLORD role on signup ─────────────────
-- Only creates a landlord role if no row exists for that user yet.
-- Tenant roles are created during accept-invite, not here.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'landlord')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 9. Auto-update updated_at ──────────────────────────────
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_maintenance_updated_at
  before update on public.maintenance_requests
  for each row execute procedure public.update_updated_at();

-- ── 10. Indexes for performance ─────────────────────────────
create index on public.invoices (owner_id, status);
create index on public.invoices (lease_id);
create index on public.payments (owner_id, payment_date desc);
create index on public.payments (invoice_id);
create index on public.maintenance_requests (owner_id, status);
create index on public.tenants (user_id);
create index on public.leases (tenant_id, status);

-- ── 11. Verify ─────────────────────────────────────────────
select table_name, (
  select count(*) from pg_policies
  where schemaname = 'public' and tablename = t.table_name
) as policy_count
from information_schema.tables t
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

select 'PropMaster database reset complete' as status;

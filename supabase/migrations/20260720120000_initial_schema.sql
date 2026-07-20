-- ============================================================
-- PropMaster — Consolidated production schema
-- Matches src/context/AppContext.tsx + src/tenant/TenantContext.tsx
-- exactly (column names, statuses, expanded capture fields).
--
-- Supersedes the ad-hoc SQL files in propmaster/*.sql.
-- Applied to project cghiodbvbggizghxuvna on 2026-07-20.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── user_roles ─────────────────────────────────────────────
create table if not exists public.user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('landlord', 'tenant')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- ── properties ─────────────────────────────────────────────
create table if not exists public.properties (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  address       text not null,
  suburb        text,
  postal_code   text,
  city          text not null,
  province      text not null,
  category      text check (category in ('residential','commercial','industrial')),
  property_type text,
  bedrooms      integer,
  bathrooms     numeric,
  bathroom_type text,
  floor         text,
  block         text,
  -- Legacy: rent now lives on the lease. Kept for back-compat.
  rent_amount   numeric not null default 0 check (rent_amount >= 0),
  unit_number   text,
  erf_size      numeric,
  lease_start   date,
  lease_end     date,
  created_at    timestamptz not null default now()
);

-- ── tenants ────────────────────────────────────────────────
create table if not exists public.tenants (
  id                  uuid primary key default uuid_generate_v4(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  user_id             uuid references auth.users(id) on delete set null,
  customer_type       text not null default 'individual' check (customer_type in ('individual','business')),
  first_name          text,
  last_name           text,
  name                text not null,
  id_number           text,
  country_issuing     text,
  email               text not null,
  secondary_email     text,
  landline            text,
  phone               text,
  business_address    text,
  business_address_2  text,
  bank_name           text,
  bank_account_number text,
  bank_branch_code    text,
  invite_status       text not null default 'none' check (invite_status in ('none','pending','accepted')),
  created_at          timestamptz not null default now()
);

-- ── leases ─────────────────────────────────────────────────
create table if not exists public.leases (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  lease_type      text not null default 'fixed_term' check (lease_type in ('fixed_term','month_to_month')),
  start_date      date not null,
  duration_months integer,
  end_date        date,
  rent_frequency  text not null default 'monthly' check (rent_frequency in ('monthly','quarterly','half_yearly','yearly')),
  due_day         integer check (due_day between 1 and 31),
  rent_amount     numeric not null check (rent_amount >= 0),
  deposit_paid    numeric not null default 0 check (deposit_paid >= 0),
  status          text not null default 'active' check (status in ('active','ended','pending','cancelled')),
  created_at      timestamptz not null default now()
);

-- Only one active lease per property
create unique index if not exists leases_one_active_per_property
  on public.leases (property_id) where status = 'active';

-- ── property_costs ─────────────────────────────────────────
create table if not exists public.property_costs (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  month        integer not null check (month between 1 and 12),
  year         integer not null check (year >= 2000),
  total_amount numeric not null default 0,
  notes        text,
  -- Legacy columns still supplied by the client as a safety net
  category     text,
  amount       numeric,
  cost_date    date,
  created_at   timestamptz not null default now(),
  unique (property_id, month, year)
);

-- ── utility_breakdowns ─────────────────────────────────────
create table if not exists public.utility_breakdowns (
  id               uuid primary key default uuid_generate_v4(),
  property_cost_id uuid not null references public.property_costs(id) on delete cascade,
  label            text not null,
  amount           numeric not null check (amount >= 0),
  is_recoverable   boolean not null default false,
  is_recurring     boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ── invoices ───────────────────────────────────────────────
create table if not exists public.invoices (
  id             uuid primary key default uuid_generate_v4(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  lease_id       uuid not null references public.leases(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  month          integer not null check (month between 1 and 12),
  year           integer not null check (year >= 2000),
  invoice_date   date,
  due_date       date not null,
  line_items     jsonb not null default '[]'::jsonb,
  total_amount   numeric not null check (total_amount >= 0),
  status         text not null default 'draft'
    check (status in ('draft','sent','partial','paid','overdue','cancelled')),
  created_at     timestamptz not null default now(),
  unique (owner_id, invoice_number)
);

-- ── payments ───────────────────────────────────────────────
create table if not exists public.payments (
  id                 uuid primary key default uuid_generate_v4(),
  property_id        uuid not null references public.properties(id) on delete cascade,
  lease_id           uuid references public.leases(id) on delete set null,
  invoice_id         uuid references public.invoices(id) on delete set null,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  amount             numeric not null check (amount > 0),
  payment_date       date not null,
  payment_method     text not null default 'bank_transfer'
    check (payment_method in ('bank_transfer','eft','cash','cheque','payfast','other')),
  status             text not null default 'verified'
    check (status in ('pending','verified','failed')),
  payfast_payment_id text,
  notes              text,
  created_at         timestamptz not null default now()
);

-- ── maintenance_requests ───────────────────────────────────
create table if not exists public.maintenance_requests (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  lease_id        uuid references public.leases(id) on delete set null,
  tenant_id       uuid references public.tenants(id) on delete set null,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  description     text,
  status          text not null default 'open'
    check (status in ('open','in_progress','resolved','closed','completed','cancelled')),
  priority        text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  resolution_note text,
  images          text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── statement_uploads ──────────────────────────────────────
create table if not exists public.statement_uploads (
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

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.user_roles           enable row level security;
alter table public.properties           enable row level security;
alter table public.tenants              enable row level security;
alter table public.leases               enable row level security;
alter table public.property_costs       enable row level security;
alter table public.utility_breakdowns   enable row level security;
alter table public.invoices             enable row level security;
alter table public.payments             enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.statement_uploads    enable row level security;

-- user_roles: read own row; landlord role is inserted by the signup
-- trigger; tenant role is set by the accept_invite() RPC below.
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

-- tenants (NO public read — accept-invite uses the RPCs below)
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
      where t.id = leases.tenant_id and t.user_id = auth.uid()
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
      where l.id = invoices.lease_id and t.user_id = auth.uid()
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
      where l.id = payments.lease_id and t.user_id = auth.uid()
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
      where t.id = maintenance_requests.tenant_id and t.user_id = auth.uid()
    )
  );

create policy "tenant insert maintenance"
  on public.maintenance_requests for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id and t.user_id = auth.uid()
    )
  );

-- statement_uploads
create policy "landlord statement uploads"
  on public.statement_uploads for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================================
-- Accept-invite RPCs
-- The magic-link user cannot pass tenant RLS before user_id is
-- linked, so linking runs through SECURITY DEFINER functions that
-- verify the caller's email matches the invited tenant's email.
-- This replaces the old `using (true)` read policy, which leaked
-- the entire tenants table (incl. bank details) to any user.
-- ============================================================

create or replace function public.get_invite_info(p_tenant_id uuid)
returns table (tenant_name text, invite_status text, already_claimed boolean, linked_to_caller boolean, property_name text)
language sql security definer stable
set search_path = public
as $$
  select
    t.name,
    t.invite_status,
    (t.user_id is not null and t.user_id <> auth.uid()),
    (t.user_id = auth.uid()),
    (select p.name
       from public.leases l
       join public.properties p on p.id = l.property_id
      where l.tenant_id = t.id and l.status = 'active'
      limit 1)
  from public.tenants t
  where t.id = p_tenant_id
    and auth.uid() is not null
    and (
      t.user_id = auth.uid()
      or lower(t.email) = lower(coalesce(
           (select u.email from auth.users u where u.id = auth.uid()), ''))
    );
$$;

create or replace function public.accept_invite(p_tenant_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_tenant public.tenants%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_tenant.user_id is not null and v_tenant.user_id <> v_uid then
    raise exception 'This invite has already been claimed by another user';
  end if;

  if v_tenant.user_id is distinct from v_uid
     and lower(v_tenant.email) <> lower(coalesce(v_email, '')) then
    raise exception 'This invite was issued to a different email address';
  end if;

  update public.tenants
     set user_id = v_uid, invite_status = 'accepted'
   where id = p_tenant_id;

  insert into public.user_roles (user_id, role)
  values (v_uid, 'tenant')
  on conflict (user_id) do update set role = 'tenant';
end;
$$;

revoke all on function public.get_invite_info(uuid) from public, anon;
revoke all on function public.accept_invite(uuid)  from public, anon;
grant execute on function public.get_invite_info(uuid) to authenticated;
grant execute on function public.accept_invite(uuid)  to authenticated;

-- ============================================================
-- Signup trigger — new users default to landlord.
-- Tenant invitees are flipped to 'tenant' by accept_invite().
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
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

-- ── updated_at maintenance ─────────────────────────────────
create or replace function public.update_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_maintenance_updated_at on public.maintenance_requests;
create trigger set_maintenance_updated_at
  before update on public.maintenance_requests
  for each row execute procedure public.update_updated_at();

-- ── Indexes ────────────────────────────────────────────────
create index if not exists idx_properties_owner       on public.properties (owner_id, created_at desc);
create index if not exists idx_tenants_owner          on public.tenants (owner_id, created_at desc);
create index if not exists idx_tenants_user           on public.tenants (user_id);
create index if not exists idx_leases_owner           on public.leases (owner_id);
create index if not exists idx_leases_tenant_status   on public.leases (tenant_id, status);
create index if not exists idx_costs_owner            on public.property_costs (owner_id, year desc);
create index if not exists idx_breakdowns_cost        on public.utility_breakdowns (property_cost_id);
create index if not exists idx_invoices_owner_status  on public.invoices (owner_id, status);
create index if not exists idx_invoices_lease         on public.invoices (lease_id);
create index if not exists idx_payments_owner_date    on public.payments (owner_id, payment_date desc);
create index if not exists idx_payments_invoice       on public.payments (invoice_id);
create index if not exists idx_maintenance_owner      on public.maintenance_requests (owner_id, status);
create index if not exists idx_maintenance_tenant     on public.maintenance_requests (tenant_id);
create index if not exists idx_uploads_owner          on public.statement_uploads (owner_id, uploaded_at desc);

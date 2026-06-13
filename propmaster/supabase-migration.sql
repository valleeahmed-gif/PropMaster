-- ============================================================
-- PropMaster — Full Database Migration
-- Paste this entire file into Supabase SQL Editor and run it
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── user_roles ─────────────────────────────────────────────
create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('landlord', 'tenant')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

-- ── properties ─────────────────────────────────────────────
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  province text not null,
  rent_amount numeric not null check (rent_amount > 0),
  lease_start date,
  lease_end date,
  created_at timestamptz not null default now()
);

-- ── tenants ────────────────────────────────────────────────
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  invite_status text not null default 'none' check (invite_status in ('none', 'pending', 'accepted')),
  created_at timestamptz not null default now()
);

-- ── leases ─────────────────────────────────────────────────
create table if not exists leases (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  rent_amount numeric not null check (rent_amount > 0),
  deposit_paid numeric not null default 0 check (deposit_paid >= 0),
  status text not null default 'active' check (status in ('active', 'ended', 'pending')),
  created_at timestamptz not null default now()
);

-- Only one active lease per property
create unique index if not exists leases_one_active_per_property
  on leases(property_id) where status = 'active';

-- ── property_costs ─────────────────────────────────────────
create table if not exists property_costs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2000),
  total_amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique(property_id, month, year)
);

-- ── utility_breakdowns ─────────────────────────────────────
create table if not exists utility_breakdowns (
  id uuid primary key default uuid_generate_v4(),
  property_cost_id uuid not null references property_costs(id) on delete cascade,
  label text not null,
  amount numeric not null check (amount >= 0),
  is_recoverable boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── invoices ───────────────────────────────────────────────
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  lease_id uuid not null references leases(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null unique,
  month integer not null check (month between 1 and 12),
  year integer not null,
  due_date date not null,
  line_items jsonb not null default '[]'::jsonb,
  total_amount numeric not null check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  created_at timestamptz not null default now()
);

-- ── payments ───────────────────────────────────────────────
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  lease_id uuid references leases(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_date date not null,
  method text not null check (method in ('payfast', 'eft', 'cash', 'other')),
  payfast_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  notes text,
  created_at timestamptz not null default now()
);

-- ── maintenance_requests ───────────────────────────────────
create table if not exists maintenance_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  lease_id uuid references leases(id) on delete set null,
  tenant_id uuid references tenants(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  images text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── statement_uploads ──────────────────────────────────────
create table if not exists statement_uploads (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  extracted_data jsonb,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'complete', 'failed')),
  property_cost_id uuid references property_costs(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table user_roles enable row level security;
alter table properties enable row level security;
alter table tenants enable row level security;
alter table leases enable row level security;
alter table property_costs enable row level security;
alter table utility_breakdowns enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table maintenance_requests enable row level security;
alter table statement_uploads enable row level security;

-- ── Helper function ────────────────────────────────────────
create or replace function has_role(uid uuid, r text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from user_roles where user_id = uid and role = r
  );
$$;

-- ── user_roles policies ────────────────────────────────────
create policy "Users can read their own roles"
  on user_roles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own roles"
  on user_roles for insert
  with check (auth.uid() = user_id);

-- ── properties policies ────────────────────────────────────
create policy "Landlords manage their own properties"
  on properties for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Tenants can view their leased properties"
  on properties for select
  using (
    exists (
      select 1 from leases l
      join tenants t on t.id = l.tenant_id
      where l.property_id = properties.id
        and t.user_id = auth.uid()
        and l.status = 'active'
    )
  );

-- ── tenants policies ───────────────────────────────────────
create policy "Landlords manage their own tenants"
  on tenants for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Tenants can view their own record"
  on tenants for select
  using (auth.uid() = user_id);

-- ── leases policies ────────────────────────────────────────
create policy "Landlords manage their own leases"
  on leases for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Tenants can view their own leases"
  on leases for select
  using (
    exists (
      select 1 from tenants t
      where t.id = leases.tenant_id and t.user_id = auth.uid()
    )
  );

-- ── property_costs policies ────────────────────────────────
create policy "Landlords manage property costs"
  on property_costs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── utility_breakdowns policies ────────────────────────────
create policy "Landlords manage utility breakdowns"
  on utility_breakdowns for all
  using (
    exists (
      select 1 from property_costs pc
      where pc.id = utility_breakdowns.property_cost_id
        and pc.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from property_costs pc
      where pc.id = utility_breakdowns.property_cost_id
        and pc.owner_id = auth.uid()
    )
  );

-- ── invoices policies ──────────────────────────────────────
create policy "Landlords manage their invoices"
  on invoices for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Tenants can view their own invoices"
  on invoices for select
  using (
    exists (
      select 1 from leases l
      join tenants t on t.id = l.tenant_id
      where l.id = invoices.lease_id and t.user_id = auth.uid()
    )
  );

-- ── payments policies ──────────────────────────────────────
create policy "Landlords manage their payments"
  on payments for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Tenants can view their own payments"
  on payments for select
  using (
    exists (
      select 1 from leases l
      join tenants t on t.id = l.tenant_id
      where l.id = payments.lease_id and t.user_id = auth.uid()
    )
  );

-- ── maintenance_requests policies ─────────────────────────
create policy "Landlords manage maintenance requests"
  on maintenance_requests for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Tenants can view and create their own requests"
  on maintenance_requests for select
  using (
    exists (
      select 1 from tenants t
      where t.id = maintenance_requests.tenant_id and t.user_id = auth.uid()
    )
  );

create policy "Tenants can insert maintenance requests"
  on maintenance_requests for insert
  with check (
    exists (
      select 1 from tenants t
      where t.id = maintenance_requests.tenant_id and t.user_id = auth.uid()
    )
  );

-- ── statement_uploads policies ─────────────────────────────
create policy "Landlords manage statement uploads"
  on statement_uploads for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================================
-- Auto-assign landlord role on signup trigger
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'landlord');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Auto-update updated_at on maintenance_requests
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_maintenance_updated_at on maintenance_requests;
create trigger set_maintenance_updated_at
  before update on maintenance_requests
  for each row execute procedure update_updated_at();

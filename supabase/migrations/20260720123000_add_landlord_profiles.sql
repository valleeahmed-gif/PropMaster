-- ============================================================
-- Per-landlord business identity, printed on invoices and reports.
-- Applied to cghiodbvbggizghxuvna 2026-07-20.
-- ============================================================

create table if not exists public.landlord_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  company_name        text,
  company_email       text,
  company_phone       text,
  company_address     text,
  vat_number          text,
  registration_number text,
  updated_at          timestamptz not null default now()
);

alter table public.landlord_profiles enable row level security;

-- Landlord manages only their own profile row.
create policy "landlord manages own profile"
  on public.landlord_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A tenant may read the profile of the landlord who owns their active lease,
-- so their invoice PDF can show the issuing company. Read-only; no financial
-- data lives here.
create policy "tenant reads their landlord profile"
  on public.landlord_profiles for select
  using (
    exists (
      select 1
      from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.owner_id = landlord_profiles.user_id
        and t.user_id = auth.uid()
        and l.status = 'active'
    )
  );

drop trigger if exists set_landlord_profiles_updated_at on public.landlord_profiles;
create trigger set_landlord_profiles_updated_at
  before update on public.landlord_profiles
  for each row execute procedure public.update_updated_at();

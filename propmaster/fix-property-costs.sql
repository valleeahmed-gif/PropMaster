-- ============================================================
-- PropMaster — property_costs constraint fix
-- Run this in Supabase SQL Editor → New query → Run
-- 
-- The existing property_costs table has NOT NULL constraints
-- on category, amount, cost_date which were from the old 
-- per-transaction model. The app uses a month/year period 
-- model instead, so we make those legacy columns nullable.
-- ============================================================

-- Make legacy columns nullable (safe — no data is dropped)
alter table public.property_costs
  alter column category drop not null;

alter table public.property_costs
  alter column amount drop not null;

alter table public.property_costs
  alter column cost_date drop not null;

-- Ensure the new columns exist (safe to re-run)
alter table public.property_costs
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.property_costs
  add column if not exists month integer check (month between 1 and 12);

alter table public.property_costs
  add column if not exists year integer check (year >= 2000);

alter table public.property_costs
  add column if not exists total_amount numeric not null default 0;

alter table public.property_costs
  add column if not exists notes text;

-- Backfill owner_id on any rows that don't have it yet
update public.property_costs pc
set owner_id = p.owner_id
from public.properties p
where p.id = pc.property_id
  and pc.owner_id is null;

-- Confirm RLS is enabled
alter table public.property_costs enable row level security;

-- Re-apply RLS policy (drop first to avoid duplicate)
drop policy if exists "Landlords full access property costs" on public.property_costs;

create policy "Landlords full access property costs"
  on public.property_costs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Done
select 'property_costs constraints fixed' as result;

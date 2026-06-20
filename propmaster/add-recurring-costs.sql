-- ============================================================
-- PropMaster — Add recurring costs support
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to run multiple times
-- ============================================================

-- Add is_recurring column to utility_breakdowns
alter table public.utility_breakdowns
  add column if not exists is_recurring boolean not null default false;

-- Done
select 'Recurring costs column added' as result;

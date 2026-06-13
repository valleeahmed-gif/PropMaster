-- PropMaster — Add unit_number and erf_size to properties
-- Run in Supabase SQL Editor → New query → Run
-- Safe to run multiple times

alter table public.properties
  add column if not exists unit_number text;

alter table public.properties
  add column if not exists erf_size numeric;

select 'unit_number and erf_size columns added to properties' as result;

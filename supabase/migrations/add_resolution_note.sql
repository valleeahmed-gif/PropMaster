-- PropMaster — Add resolution_note to maintenance_requests
-- Run in Supabase SQL Editor → New query → Run

alter table public.maintenance_requests
  add column if not exists resolution_note text;

select 'resolution_note column added to maintenance_requests' as result;

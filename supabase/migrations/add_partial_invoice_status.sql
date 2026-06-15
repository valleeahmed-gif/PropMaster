-- PropMaster — Add partial invoice status
-- Run in Supabase SQL Editor → New query → Run

-- Widen the invoice status check to include 'partial'
alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
    check (status in ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'));

select 'Invoice status constraint updated to include partial' as result;

-- ============================================================
-- Integrity + tenant-access hardening (audit 2026-11-04)
--
-- RLS policies only checked `owner_id = auth.uid()` on the row being
-- written. They did NOT check that the rows it *references* belong to
-- the same owner, so a signed-in user who learned another landlord's
-- property UUID could:
--   * create a lease pointing at that property (with a tenant record
--     whose user_id they controlled) and then read it through the
--     "tenant view leased property" policy;
--   * as a tenant, insert maintenance requests against any property /
--     owner_id, pre-set to any status;
--   * as a landlord, set tenants.user_id to an arbitrary auth user.
-- Tenants could also read landlords' unsent DRAFT invoices.
--
-- This migration closes those gaps with BEFORE INSERT/UPDATE triggers
-- (they apply to every client, independent of which policy matched)
-- and tightens two policies. It is idempotent.
-- ============================================================

-- ── 1. user_roles: clients never write roles directly ───────
-- Roles are created by the signup trigger and flipped to 'tenant' by
-- the accept_invite() RPC. A direct insert path is unnecessary.
drop policy if exists "own roles insert" on public.user_roles;

-- ── 2. Tenants must not see draft invoices ──────────────────
drop policy if exists "tenant own invoices" on public.invoices;
create policy "tenant own invoices"
  on public.invoices for select
  using (
    status <> 'draft'
    and exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = invoices.lease_id and t.user_id = auth.uid()
    )
  );

-- ── 3. Cross-reference ownership checks ─────────────────────
-- SECURITY DEFINER so the lookups are not themselves filtered by RLS
-- (e.g. a tenant inserting maintenance can't see the tenants table rows
-- of other users, but we still need to verify against them).

create or replace function public.pm_assert_property_owner(p_property uuid, p_owner uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_property is null then return; end if;
  if not exists (select 1 from public.properties where id = p_property and owner_id = p_owner) then
    raise exception 'Property does not belong to this account' using errcode = '42501';
  end if;
end $$;

create or replace function public.pm_check_lease_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.pm_assert_property_owner(new.property_id, new.owner_id);
  if not exists (select 1 from public.tenants where id = new.tenant_id and owner_id = new.owner_id) then
    raise exception 'Tenant does not belong to this account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.pm_check_invoice_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.pm_assert_property_owner(new.property_id, new.owner_id);
  if not exists (
    select 1 from public.leases
     where id = new.lease_id and owner_id = new.owner_id and property_id = new.property_id
  ) then
    raise exception 'Lease does not belong to this property/account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.pm_check_payment_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.pm_assert_property_owner(new.property_id, new.owner_id);
  if new.lease_id is not null and not exists (
    select 1 from public.leases where id = new.lease_id and owner_id = new.owner_id
  ) then
    raise exception 'Lease does not belong to this account' using errcode = '42501';
  end if;
  if new.invoice_id is not null and not exists (
    select 1 from public.invoices where id = new.invoice_id and owner_id = new.owner_id
  ) then
    raise exception 'Invoice does not belong to this account' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.pm_check_property_child_refs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.pm_assert_property_owner(new.property_id, new.owner_id);
  return new;
end $$;

create or replace function public.pm_check_maintenance_refs()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  perform public.pm_assert_property_owner(new.property_id, new.owner_id);

  if new.tenant_id is not null and not exists (
    select 1 from public.tenants where id = new.tenant_id and owner_id = new.owner_id
  ) then
    raise exception 'Tenant does not belong to this account' using errcode = '42501';
  end if;

  -- Writes by a tenant (anyone who isn't the owning landlord): must be a
  -- fresh 'open' request for a property they actively lease from this owner.
  if v_uid is not null and v_uid <> new.owner_id then
    if tg_op <> 'INSERT' then
      raise exception 'Only the landlord can update maintenance requests' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where t.id = new.tenant_id
        and t.user_id = v_uid
        and l.property_id = new.property_id
        and l.owner_id = new.owner_id
        and l.status = 'active'
        and (new.lease_id is null or l.id = new.lease_id)
    ) then
      raise exception 'No active lease for this property' using errcode = '42501';
    end if;
    new.status := 'open';
    new.resolution_note := null;
  end if;
  return new;
end $$;

-- tenants.user_id may only be set to the caller themself (accept_invite)
-- or cleared. Stops a landlord linking a tenant record to someone else.
create or replace function public.pm_guard_tenant_user_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null
     and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id)
     and new.user_id is distinct from auth.uid() then
    raise exception 'Tenant accounts are linked through the invite flow only' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists pm_check_lease_refs on public.leases;
create trigger pm_check_lease_refs before insert or update of property_id, tenant_id, owner_id
  on public.leases for each row execute function public.pm_check_lease_refs();

drop trigger if exists pm_check_invoice_refs on public.invoices;
create trigger pm_check_invoice_refs before insert or update of property_id, lease_id, owner_id
  on public.invoices for each row execute function public.pm_check_invoice_refs();

drop trigger if exists pm_check_payment_refs on public.payments;
create trigger pm_check_payment_refs before insert or update of property_id, lease_id, invoice_id, owner_id
  on public.payments for each row execute function public.pm_check_payment_refs();

drop trigger if exists pm_check_cost_refs on public.property_costs;
create trigger pm_check_cost_refs before insert or update of property_id, owner_id
  on public.property_costs for each row execute function public.pm_check_property_child_refs();

drop trigger if exists pm_check_upload_refs on public.statement_uploads;
create trigger pm_check_upload_refs before insert or update of property_id, owner_id
  on public.statement_uploads for each row execute function public.pm_check_property_child_refs();

drop trigger if exists pm_check_maintenance_refs on public.maintenance_requests;
create trigger pm_check_maintenance_refs before insert or update
  on public.maintenance_requests for each row execute function public.pm_check_maintenance_refs();

drop trigger if exists pm_guard_tenant_user_link on public.tenants;
create trigger pm_guard_tenant_user_link before insert or update of user_id
  on public.tenants for each row execute function public.pm_guard_tenant_user_link();

-- Trigger functions are not meant to be called over the REST API.
revoke all on function public.pm_assert_property_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function public.pm_check_lease_refs()          from public, anon, authenticated;
revoke all on function public.pm_check_invoice_refs()        from public, anon, authenticated;
revoke all on function public.pm_check_payment_refs()        from public, anon, authenticated;
revoke all on function public.pm_check_property_child_refs() from public, anon, authenticated;
revoke all on function public.pm_check_maintenance_refs()    from public, anon, authenticated;
revoke all on function public.pm_guard_tenant_user_link()    from public, anon, authenticated;

-- ── 4. Keep property_costs.total_amount consistent ──────────
-- The client used to recompute totals from stale React state, so bulk
-- inserts (AI extraction, "copy recurring") saved a wrong total. The
-- database now owns the number.
create or replace function public.pm_sync_cost_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  if tg_op = 'DELETE' then v_ids := array[old.property_cost_id];
  elsif tg_op = 'UPDATE' then v_ids := array[old.property_cost_id, new.property_cost_id];
  else v_ids := array[new.property_cost_id];
  end if;
  update public.property_costs pc
     set total_amount = coalesce((select sum(b.amount) from public.utility_breakdowns b
                                   where b.property_cost_id = pc.id), 0)
   where pc.id = any(v_ids);
  return null;
end $$;
revoke all on function public.pm_sync_cost_total() from public, anon, authenticated;

drop trigger if exists pm_sync_cost_total on public.utility_breakdowns;
create trigger pm_sync_cost_total after insert or update of amount, property_cost_id or delete
  on public.utility_breakdowns for each row execute function public.pm_sync_cost_total();

-- One-off repair of any totals already saved wrong.
update public.property_costs pc
   set total_amount = coalesce((select sum(b.amount) from public.utility_breakdowns b
                                 where b.property_cost_id = pc.id), 0)
 where pc.total_amount is distinct from coalesce((select sum(b.amount) from public.utility_breakdowns b
                                                   where b.property_cost_id = pc.id), 0);

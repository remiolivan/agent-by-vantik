-- Applied 25/09/2026 (Supabase migration "security_lock_billing_columns_and_paywall")

-- 1. organizations: users may only update the columns the app actually edits.
--    plan / is_comped / trial_ends_at / suspension / stripe ids / cancellation
--    are server-only (stripe-webhook, cancel-subscription, admin-api use service role).
revoke update on public.organizations from anon, authenticated;
grant update (
  name, base_currency,
  invoice_business_name, invoice_address, invoice_trn, invoice_iban, invoice_email, invoice_phone,
  logo_url, invoice_stamp_url, onboarding_completed
) on public.organizations to authenticated;

-- 2. subscriptions: read-only for users; only stripe-webhook (service role) writes.
drop policy if exists subscriptions_all on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (org_id = current_org_id());

-- 3. memberships: no self-service insert/delete/role changes (invites go through
--    the invite-agent edge function). Users may only toggle their own digest.
drop policy if exists memberships_insert on public.memberships;
drop policy if exists memberships_delete on public.memberships;
drop policy if exists memberships_update on public.memberships;
create policy memberships_update_self on public.memberships
  for update to authenticated
  using (id = current_membership_id())
  with check (id = current_membership_id());
revoke update on public.memberships from anon, authenticated;
grant update (morning_digest_enabled) on public.memberships to authenticated;

-- 4. Paywall in the database. Same rule as src/lib/access.js, plus suspension.
create or replace function public.org_has_access(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organizations o
    where o.id = p_org_id
      and o.suspended_at is null
      and (
        o.is_comped
        or o.plan in ('solo', 'team', 'brokerage')
        or (o.trial_ends_at is not null and o.trial_ends_at > now())
      )
  );
$$;
revoke execute on function public.org_has_access(uuid) from public, anon;
grant execute on function public.org_has_access(uuid) to authenticated, service_role;

-- Writes (insert/update) require access; reads and deletes are unchanged.
alter policy contacts_all        on public.contacts        with check (org_id = current_org_id() and org_has_access(org_id));
alter policy properties_all      on public.properties      with check (org_id = current_org_id() and org_has_access(org_id));
alter policy documents_all       on public.documents       with check (org_id = current_org_id() and org_has_access(org_id));
alter policy tasks_all           on public.tasks           with check (org_id = current_org_id() and org_has_access(org_id));
alter policy reminders_all       on public.reminders       with check (org_id = current_org_id() and org_has_access(org_id));
alter policy calendar_events_all on public.calendar_events with check (org_id = current_org_id() and org_has_access(org_id));
alter policy pipeline_stages_all on public.pipeline_stages with check (org_id = current_org_id() and org_has_access(org_id));
alter policy activities_insert   on public.activities      with check (org_id = current_org_id() and org_has_access(org_id));

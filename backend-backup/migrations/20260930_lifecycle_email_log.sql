-- Applied 2026-09-30 (migration "lifecycle_email_log"). Already in the database: do not re-apply.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email_key text not null,
  recipient text,
  resend_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_log_org_key_unique unique (org_id, email_key)
);
comment on table public.email_log is 'Lifecycle emails (welcome, trial, payment, cancellation). One row per (org, email_key) = sent at most once. Server-only.';
alter table public.email_log enable row level security;
-- no policies: only the service role (edge functions) reads/writes.

-- Backfill: existing orgs and subscriptions must not receive retroactive emails.
insert into public.email_log (org_id, email_key, recipient, sent_at)
select o.id, k, 'backfill', now()
from public.organizations o
cross join unnest(array['welcome','day1_empty_pipeline','trial_midpoint','trial_ending_48h','trial_ended']) as k
on conflict do nothing;

insert into public.email_log (org_id, email_key, recipient, sent_at)
select s.org_id, k || ':' || s.stripe_subscription_id, 'backfill', now()
from public.subscriptions s
cross join unnest(array['payment_confirmed','cancellation_confirmed']) as k
on conflict do nothing;

-- Cron (created separately, secret not stored here):
-- select cron.schedule('lifecycle-emails-15min', '*/15 * * * *', $$ select net.http_post(
--   url := 'https://ppommcjfwwrvmtdinitw.supabase.co/functions/v1/lifecycle-emails',
--   headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>')) $$);

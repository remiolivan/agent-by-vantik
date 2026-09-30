-- Applied 24/09/2026 (Supabase migration "stripe_subscriptions_hardening")
alter table public.subscriptions
  add column if not exists billing_interval text
  check (billing_interval in ('monthly','annual'));

alter table public.subscriptions
  add constraint subscriptions_stripe_subscription_id_key unique (stripe_subscription_id);

alter table public.subscriptions drop constraint subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused'));

create index if not exists subscriptions_org_id_idx on public.subscriptions (org_id);

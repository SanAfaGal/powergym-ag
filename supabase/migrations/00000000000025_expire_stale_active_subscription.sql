-- supabase/migrations/00000000000025_expire_stale_active_subscription.sql
--
-- expire_subscriptions() (migration 0009) only runs once a day via pg_cron,
-- at midnight Bogota. In the up-to-24h window before that tick, a lapsed
-- membership still reads status='active' in the DB, which blocked
-- createSubscription's "does this client already have an open
-- subscription" check from ever letting staff enroll them in a new one --
-- a real front-desk complaint (forgot to renew yesterday, tries today,
-- gets stuck).
--
-- This isn't just a display fix: one_active_subscription_per_client
-- (migration 0005) is a unique partial index on status='active', so simply
-- ignoring the stale row in the open-subscription check isn't enough --
-- if the new subscription got paid in full immediately, record_payment's
-- own "mark active" step would collide with the still-active stale row and
-- fail with a raw 23505. Actually expiring the stale row up front avoids
-- that collision entirely.
--
-- SECURITY INVOKER (not DEFINER, unlike expire_subscriptions itself): this
-- runs as the calling staff member, gated by the existing
-- subscriptions_update RLS policy (is_active_staff()), and is scoped to
-- one client_id -- so, unlike expire_subscriptions(), it's safe to leave
-- at its default PUBLIC execute grant (same reasoning as
-- create_subscription's security-invoker comment in migration 0009).
create function public.expire_stale_active_subscription(p_client_id uuid)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.subscriptions
  set status = 'expired'
  where client_id = p_client_id
    and status = 'active'
    and end_date < public.today_bogota();
$$;

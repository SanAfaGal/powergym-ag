-- supabase/migrations/00000000000009_cron_jobs.sql
create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and end_date < (now() at time zone 'America/Bogota')::date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.activate_scheduled_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.subscriptions s
  set status = 'pending_payment'
  where s.status = 'scheduled'
    and s.start_date <= (now() at time zone 'America/Bogota')::date
    and not exists (
      select 1 from public.subscriptions s2
      where s2.client_id = s.client_id and s2.status = 'active'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- NOTE: the brief's literal SQL creates both functions with no privilege
-- statements. Postgres grants EXECUTE on new functions to the PUBLIC
-- pseudo-role by default, and this project has not disabled that (confirmed
-- empirically: `anon` and `authenticated` already have EXECUTE on existing
-- functions such as create_subscription/calculate_end_date with no explicit
-- grant). For SECURITY INVOKER functions like create_subscription that is
-- harmless, because the underlying table grants/RLS policies (migration
-- 0007) still gate the actual writes. It is NOT harmless here: both
-- functions above are SECURITY DEFINER, run as the function owner
-- (postgres), and unconditionally mutate every client's subscriptions with
-- no auth.uid()/RLS check at all. Left at the default PUBLIC grant, any
-- `anon` or `authenticated` caller could hit
-- `POST /rest/v1/rpc/expire_subscriptions` (both are in the API-exposed
-- `public` schema per supabase/config.toml) and force a mass status change
-- across the whole table any time they liked -- these RPCs exist solely for
-- pg_cron (which calls them in-process as the migration-owning role, not
-- over the Data API) and for ops to trigger manually with the service key,
-- per the brief's own interfaces note ("only ops depends on it existing in
-- prod"). Revoking the default PUBLIC grant and re-granting only to
-- `service_role` closes that hole without affecting pg_cron (which never
-- goes through a granted role check to call its own scheduled command) or
-- pgTAP (which connects as the `postgres` superuser and bypasses grants
-- entirely).
revoke execute on function public.expire_subscriptions() from public;
revoke execute on function public.activate_scheduled_subscriptions() from public;
grant execute on function public.expire_subscriptions() to service_role;
grant execute on function public.activate_scheduled_subscriptions() to service_role;

select cron.schedule(
  'expire-subscriptions',
  '0 5 * * *',
  $$select public.expire_subscriptions();$$
);

select cron.schedule(
  'activate-scheduled-subscriptions',
  '5 5 * * *',
  $$select public.activate_scheduled_subscriptions();$$
);

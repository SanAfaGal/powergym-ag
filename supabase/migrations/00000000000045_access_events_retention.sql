-- supabase/migrations/00000000000045_access_events_retention.sql
--
-- Retention policy: access events are kept 12 months, then purged nightly.
-- Same privilege pattern as expire_subscriptions() (migration 0009): the
-- function is SECURITY DEFINER and unconditionally deletes across the whole
-- table, so the default PUBLIC execute grant is revoked and only
-- service_role may call it. pg_cron runs it in-process, unaffected by grants.
create function public.purge_old_access_events()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.access_events
  where occurred_at < now() - interval '12 months';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_old_access_events() from public;
grant execute on function public.purge_old_access_events() to service_role;

select cron.schedule(
  'purge-access-events',
  '30 5 * * *',
  $$select public.purge_old_access_events();$$
);

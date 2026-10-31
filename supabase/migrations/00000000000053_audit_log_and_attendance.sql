-- supabase/migrations/00000000000053_audit_log_and_attendance.sql
--
-- 1. audit_log: who changed money, subscriptions, prices, bank accounts and
--    staff access, and what the row looked like before/after. Written only by
--    a trigger (security definer); admins read it, nobody can edit or delete
--    rows through the API.
-- 2. access_events index for the "granted entries of a client" lookups used by
--    the cooldown check and attendance.
-- 3. get_client_attendance(): aggregates granted entries per Bogota day in SQL
--    instead of shipping up to 5000 timestamps to Node.

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;

grant select on public.audit_log to authenticated;

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_active_admin());

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- updated_at-only touches carry no information
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return new;
  end if;

  insert into public.audit_log (actor_id, table_name, record_id, action, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    tg_op,
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_row_change() from public;

create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();
create trigger audit_subscriptions
  after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row_change();
create trigger audit_plan_prices
  after insert or update or delete on public.plan_prices
  for each row execute function public.audit_row_change();
create trigger audit_bank_accounts
  after insert or update or delete on public.bank_accounts
  for each row execute function public.audit_row_change();
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

create index access_events_client_granted_idx
  on public.access_events (client_id, occurred_at desc)
  where decision = 'granted';

-- One row per Bogota day with a granted entry in the retained history, with
-- the latest entry of that day. security invoker: access_events RLS decides
-- who can read it.
create or replace function public.get_client_attendance(p_client_id uuid)
returns table (day date, last_at timestamptz)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (occurred_at at time zone 'America/Bogota')::date as day,
    max(occurred_at) as last_at
  from public.access_events
  where client_id = p_client_id
    and decision = 'granted'
  group by 1
  order by 1 desc
$$;

revoke execute on function public.get_client_attendance(uuid) from public;
grant execute on function public.get_client_attendance(uuid) to authenticated;

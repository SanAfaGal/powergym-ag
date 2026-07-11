-- supabase/migrations/00000000000016_plan_create_rpc.sql
--
-- Creating a plan is a two-table write (plans + an initial plan_prices
-- row) since migration 0013 moved price out of plans into an append-only
-- history. Wrapping both inserts in one SECURITY INVOKER function makes
-- them atomic (both succeed or both roll back) -- a plan with no price row
-- is a state nothing else in the app can make sense of. No internal admin
-- check needed: both underlying inserts still go through their own RLS
-- policies (plans_insert / plan_prices_write, both is_active_admin()-gated)
-- exactly as if the caller had issued them directly -- same reasoning
-- create_subscription (migration 0008) uses for relying on clients_insert/
-- subscriptions_insert RLS rather than re-checking internally.

create or replace function public.create_plan(
  p_name text,
  p_price numeric,
  p_duration_unit duration_type_enum,
  p_duration_count integer,
  p_description text default null,
  p_slug text default null,
  p_currency char(3) default 'COP'
) returns public.plans
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans;
begin
  insert into public.plans (name, description, slug, currency, duration_unit, duration_count)
  values (p_name, p_description, p_slug, p_currency, p_duration_unit, p_duration_count)
  returning * into v_plan;

  insert into public.plan_prices (plan_id, price, created_by)
  values (v_plan.id, p_price, auth.uid());

  return v_plan;
end;
$$;

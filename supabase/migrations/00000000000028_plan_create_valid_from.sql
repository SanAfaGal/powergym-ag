-- supabase/migrations/00000000000028_plan_create_valid_from.sql
--
-- create_plan (migration 0016) always let plan_prices.valid_from fall back
-- to its column default (today_bogota(), migration 0019) -- there was no
-- way to set a plan's initial price as effective on any other date. That
-- directly caused the "plan has no price effective on %" failure staff hit
-- backdating a subscription's start_date to before the plan itself was
-- created (migration 0027 made that failure legible; this lets staff avoid
-- it in the first place for a brand-new plan by choosing its effective
-- date up front -- useful when digitizing a plan that's been informally
-- running for a while, or preloading one that starts later).
--
-- A function's identity for CREATE OR REPLACE purposes is its parameter
-- TYPE list -- adding a trailing parameter (even with a default) changes
-- that list, so plain CREATE OR REPLACE would create a second overload
-- instead of replacing the original, and any 4-arg call (relying on the
-- other 3 original defaults) would then be ambiguous between the two.
-- Must drop the old 7-arg signature first, same as migration 0023.
drop function public.create_plan(text, numeric, duration_type_enum, integer, text, text, char(3));

create function public.create_plan(
  p_name text,
  p_price numeric,
  p_duration_unit duration_type_enum,
  p_duration_count integer,
  p_description text default null,
  p_slug text default null,
  p_currency char(3) default 'COP',
  p_valid_from date default null
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

  insert into public.plan_prices (plan_id, price, valid_from, created_by)
  values (v_plan.id, p_price, coalesce(p_valid_from, public.today_bogota()), auth.uid());

  return v_plan;
end;
$$;

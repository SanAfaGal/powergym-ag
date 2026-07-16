-- supabase/migrations/00000000000031_plans_with_current_price.sql
--
-- listPlans() and listActivePlansWithPrice() (src/modules/plans/queries.ts,
-- src/modules/subscriptions/queries.ts) each fetch all plans, then call the
-- plan_price_at RPC once per plan via Promise.all -- N+1 round trips to
-- Postgres. This adds a single read-only function that returns every plan
-- joined with its current price in one query (LATERAL join against
-- plan_prices), mirroring plan_price_at's own tie-break order
-- (valid_from desc, created_at desc -- see migration 0017).
--
-- plan_price_at itself is untouched: it's still used for point-in-time
-- lookups by create_subscription/renew_subscription/currentPriceFor.

create or replace function public.plans_with_current_price(
  p_active_only boolean default false
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  currency char(3),
  duration_unit duration_type_enum,
  duration_count integer,
  is_active boolean,
  created_at timestamptz,
  current_price numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id, p.name, p.slug, p.description, p.currency,
    p.duration_unit, p.duration_count, p.is_active, p.created_at,
    pp.price as current_price
  from public.plans p
  left join lateral (
    select price from public.plan_prices
    where plan_id = p.id
      and valid_from <= public.today_bogota()
      and (valid_until is null or valid_until >= public.today_bogota())
    order by valid_from desc, created_at desc
    limit 1
  ) pp on true
  where (not p_active_only or p.is_active)
  order by p.created_at desc
$$;

grant execute on function public.plans_with_current_price(boolean) to authenticated;

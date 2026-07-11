-- supabase/migrations/00000000000018_cancel_scheduled_plan_price_rpc.sql
--
-- Bug: the app layer's cancelScheduledPrice just deleted the future
-- plan_prices row directly. That undid the SCHEDULING but not the SIDE
-- EFFECT of scheduling it -- plan_prices_close_previous had already closed
-- the row before it (valid_until = the cancelled row's valid_from - 1, or
-- same day for a same-day correction). Deleting the future row alone left
-- a coverage gap: no open row from the day after that closed row's
-- valid_until onward, so plan_price_at would return NULL past that date.
--
-- Fix: wrap delete + reopen in one function so they're atomic (both
-- happen or neither does), same reasoning as create_plan (migration 0016)
-- for its two-table write. The row to reopen is identified as the most
-- recently closed row for the plan -- by construction (only one row is
-- ever open at a time, and the trigger always closes exactly the
-- previously-open row when a new one lands) that's exactly the row the
-- cancelled one had closed.

create or replace function public.cancel_scheduled_plan_price(p_price_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row public.plan_prices;
begin
  select * into v_row from public.plan_prices where id = p_price_id;
  if not found then
    raise exception 'price row % not found', p_price_id;
  end if;

  if v_row.valid_from <= public.today_bogota() then
    raise exception 'only a not-yet-effective (future) price can be cancelled';
  end if;

  delete from public.plan_prices where id = p_price_id;

  update public.plan_prices
  set valid_until = null
  where id = (
    select id from public.plan_prices
    where plan_id = v_row.plan_id and valid_until is not null
    order by valid_until desc, created_at desc
    limit 1
  );
end;
$$;

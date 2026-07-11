-- supabase/migrations/00000000000017_fix_plan_price_same_day_duplicate.sql
--
-- Bug: plan_prices_close_previous (migration 0013) only closed the
-- previous open row when its valid_from was STRICTLY earlier than the new
-- row's. Scheduling a price effective the same day as the existing open
-- row (e.g. a same-day correction) left both rows open with valid_until
-- null -- two "vigente" rows for the same plan at once.
--
-- Fix: the previous open row is still CLOSED, never deleted -- it's real
-- history (a price that was genuinely in effect, even if only for part of
-- a day) and stays in plan_prices. For a genuinely future row, it closes
-- the day before (no overlap). For a same-day correction, it closes ON
-- that same day (a one-day overlap by construction) and plan_price_at
-- breaks the tie by created_at -- the more recently created row wins,
-- i.e. the correction, not the row it corrected.
--
-- Also adds a partial unique index as a hard invariant (defense in depth
-- against the same bug class in any future form, concurrent inserts
-- included), mirroring the existing one_active_subscription_per_client
-- pattern.
--
-- The trigger also moves from AFTER to BEFORE INSERT: with the new unique
-- index in place, an AFTER trigger is too late -- the new row would already
-- be in the index (conflicting with the still-open old row) by the time
-- the trigger runs to close it. Closing the old row BEFORE the new row's
-- own index entry is written avoids that transient conflict.

create or replace function public.close_previous_plan_price()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.plan_prices
  set valid_until = case
    when valid_from = new.valid_from then new.valid_from
    else new.valid_from - 1
  end
  where plan_id = new.plan_id
    and valid_until is null
    and valid_from <= new.valid_from
    and id <> new.id;

  return new;
end;
$$;

drop trigger plan_prices_close_previous on public.plan_prices;

create trigger plan_prices_close_previous
  before insert on public.plan_prices
  for each row execute function public.close_previous_plan_price();

create unique index plan_prices_one_open_per_plan
  on public.plan_prices (plan_id)
  where (valid_until is null);

-- created_at's original default (now(), migration 0013) is frozen at
-- transaction start, not wall-clock time -- two inserts in the same
-- transaction get an IDENTICAL created_at, which defeats the tiebreak
-- below the moment it's needed most (a same-day correction issued
-- immediately after the row it corrects, still in-flight in the same
-- request). clock_timestamp() actually advances between statements
-- regardless of transaction boundaries.
alter table public.plan_prices
  alter column created_at set default clock_timestamp();

-- Tiebreaker for the same-day-overlap case above: two rows can now share
-- a valid_from/valid_until boundary date (the day the correction lands),
-- so "order by valid_from desc" alone no longer uniquely determines a
-- winner for that date. created_at desc resolves it deterministically --
-- the row created later is the intended correction.
create or replace function public.plan_price_at(
  p_plan_id uuid,
  p_date date default current_date
) returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select price from public.plan_prices
  where plan_id = p_plan_id
    and valid_from <= p_date
    and (valid_until is null or valid_until >= p_date)
  order by valid_from desc, created_at desc
  limit 1
$$;

-- Needed by cancelScheduledPrice (app layer): an admin can delete a
-- not-yet-effective (future) row to undo a scheduling mistake. RLS
-- (plan_prices_write, "for all") already restricts this to admins; the
-- grant just allows the privilege check to be reached at all. Past/current
-- rows are never deleted -- the app layer only allows cancelling rows
-- whose valid_from is still in the future.
grant delete on public.plan_prices to authenticated;

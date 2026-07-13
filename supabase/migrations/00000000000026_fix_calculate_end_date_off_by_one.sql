-- supabase/migrations/00000000000026_fix_calculate_end_date_off_by_one.sql
--
-- calculate_end_date (migration 0008) computed end_date as `start + N`,
-- which is one calendar day too many: renew_subscription starts the next
-- period at `end_date + 1`, which only makes sense if end_date is the LAST
-- day included in the current period, not an exclusive boundary. A 1-day
-- plan starting 2026-07-13 was ending 2026-07-14 -- covering 2 calendar
-- days instead of 1 -- and every other duration unit had the same extra
-- day baked in. Subtracting a day makes an N-unit period span exactly N
-- calendar days (or N months/weeks/years) ending on its last inclusive day.
--
-- Same signature as the original (no renamed params), so a plain
-- CREATE OR REPLACE is enough -- no DROP needed (contrast migration 0023,
-- which renamed a parameter and required one).
--
-- Deliberately NOT backfilling existing subscriptions' already-stored
-- end_date: like discount_amount (migration 0023), this only changes how
-- NEW subscriptions are calculated going forward.
create or replace function public.calculate_end_date(
  p_start date,
  p_unit duration_type_enum,
  p_count integer
) returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select ((case p_unit
    when 'day' then p_start + (p_count || ' days')::interval
    when 'week' then p_start + (p_count || ' weeks')::interval
    when 'month' then p_start + (p_count || ' months')::interval
    when 'year' then p_start + (p_count || ' years')::interval
  end) - interval '1 day')::date
$$;

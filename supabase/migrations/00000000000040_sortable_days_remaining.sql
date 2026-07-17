-- supabase/migrations/00000000000040_sortable_days_remaining.sql
--
-- days_remaining_asc previously sorted raw days_remaining, which for an
-- expired subscription is a (large) negative number -- so the most overdue
-- clients floated to the very top of the default "closest to expiring"
-- view, ahead of clients who actually still have days left. The UI already
-- treats negative days_remaining as "not applicable" (shows a dash instead
-- of a day count, see daysRemainingClass/ClientTable), the sort should too.
--
-- sort_days_remaining mirrors days_remaining but nulls out anything < 0, so
-- ordering by it with nulls-last groups "still counting down" clients first
-- (soonest first), then pushes expired/no-subscription clients to the end
-- together. days_remaining itself is untouched -- nothing else reads it for
-- display of negative values, but no reason to change its meaning.

create or replace view public.client_subscription_overview
with (security_invoker = true)
as
select
  c.*,
  s.id as subscription_id,
  s.status as subscription_status,
  s.plan_id,
  p.name as plan_name,
  s.start_date,
  s.end_date,
  s.final_price,
  case when s.id is not null then coalesce(pay.paid, 0) end as paid,
  case when s.id is not null
    then greatest(s.final_price - coalesce(pay.paid, 0), 0)
  end as remaining,
  case when s.id is not null
    then s.end_date - public.today_bogota()
  end as days_remaining,
  case when s.id is not null and (s.end_date - public.today_bogota()) >= 0
    then s.end_date - public.today_bogota()
  end as sort_days_remaining
from public.clients c
left join lateral (
  select *
  from public.subscriptions sub
  where sub.client_id = c.id
  order by
    case sub.status
      when 'active' then 1
      when 'pending_payment' then 2
      when 'scheduled' then 3
      when 'expired' then 4
      when 'canceled' then 5
    end,
    sub.start_date desc,
    sub.created_at desc
  limit 1
) s on true
left join public.plans p on p.id = s.plan_id
left join lateral (
  select sum(pmt.amount) as paid
  from public.payments pmt
  where pmt.subscription_id = s.id
) pay on true;

grant select on public.client_subscription_overview to authenticated;

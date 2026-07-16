-- supabase/migrations/00000000000033_client_subscription_overview.sql
--
-- Backs the merged /clients page (replaces the separate /subscriptions
-- list): one row per client, joined to their single most-relevant
-- subscription. A client can have more than one non-active subscription at
-- once (only "at most one ACTIVE" is enforced -- see
-- one_active_subscription_per_client), so picking "the" subscription needs
-- a priority order, not just "most recent": active > pending_payment >
-- scheduled > expired > canceled, tie-broken by start_date desc then
-- created_at desc (same tie-break plan_price_at uses, migration 0017).
--
-- security_invoker so this runs as the querying role, not the view owner --
-- clients/subscriptions/payments/plans are all gated by the same
-- is_active_staff() policy (migration 0007), so results stay consistent
-- with what each of those tables would return directly.

create view public.client_subscription_overview
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
  end as days_remaining
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

-- supabase/migrations/00000000000038_record_payment_date.sql
--
-- record_payment always dated a payment "now" (payment_date's column
-- default). Staff sometimes records a payment a day (or more) after it was
-- actually received, and payment_date is what get_daily_activity,
-- get_dashboard_stats' revenue_in_range/revenue_by_method, and
-- listRevenueByBankAccount group/filter by -- a late entry silently
-- inflated the wrong day's numbers everywhere. Adds an optional
-- p_payment_date, appended at the end so existing positional callers
-- (008_subscription_rpcs.test.sql, 022_record_payment_validations.test.sql)
-- keep working unchanged, defaulting to the current behavior when omitted.
--
-- create or replace only replaces a function whose argument list matches
-- exactly -- a different parameter count creates a new overload instead,
-- leaving both callable with 4 positional args and every existing call
-- ambiguous ("is not unique"). Same pitfall migration 0012 hit changing
-- this same function's signature; same fix, drop the old one first.
drop function if exists public.record_payment(uuid, numeric, text, text, uuid);

create or replace function public.record_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text default null,
  p_bank_account_id uuid default null,
  p_payment_date date default null
) returns public.payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions;
  v_already_paid numeric(10,2);
  v_payment public.payments;
  v_payment_timestamp timestamptz;
begin
  if p_payment_date is not null and p_payment_date > public.today_bogota() then
    raise exception 'La fecha del pago no puede ser posterior a hoy';
  end if;

  select * into v_subscription from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'subscription % not found', p_subscription_id; end if;

  if v_subscription.status not in ('pending_payment', 'scheduled') then
    raise exception 'Esta suscripción no puede recibir pagos en su estado actual';
  end if;

  select coalesce(sum(amount), 0) into v_already_paid from public.payments where subscription_id = p_subscription_id;
  if v_already_paid + p_amount > v_subscription.final_price then
    raise exception 'El monto supera el saldo pendiente de la suscripción';
  end if;

  -- A chosen past date keeps "now"'s Bogota time-of-day transplanted onto
  -- it, so multiple backdated payments entered in sequence still sort
  -- sensibly relative to each other. Omitted (null) keeps the exact
  -- previous behavior: now().
  v_payment_timestamp := coalesce(
    (p_payment_date::timestamp + (now() at time zone 'America/Bogota')::time)
      at time zone 'America/Bogota',
    now()
  );

  insert into public.payments (subscription_id, amount, payment_method, received_by, notes, bank_account_id, payment_date)
  values (p_subscription_id, p_amount, p_method, auth.uid(), p_notes, p_bank_account_id, v_payment_timestamp)
  returning * into v_payment;

  if v_subscription.status = 'pending_payment' and v_already_paid + p_amount >= v_subscription.final_price then
    update public.subscriptions set status = 'active' where id = p_subscription_id;
  end if;

  return v_payment;
end;
$$;

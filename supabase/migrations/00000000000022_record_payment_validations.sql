-- supabase/migrations/00000000000022_record_payment_validations.sql
--
-- record_payment (migration 0012) had no guard against recording more money
-- than a subscription is worth, or against recording a payment on a
-- subscription that isn't actually awaiting one (active/expired/canceled).
-- Both are silent data-integrity holes: nothing enforced them beyond the UI
-- hiding the "Registrar pago" button for the wrong statuses (SubscriptionsSection's
-- PAYABLE_STATUSES), which a direct RPC call -- or a future UI bug -- bypasses
-- entirely. This adds both checks to the function itself, the actual source
-- of truth per this codebase's existing convention (see the paymentSchema
-- comment in src/modules/subscriptions/schema.ts, and how
-- set_staff_role/set_staff_active raise a matched, user-facing message for
-- their own invariant in migration 0021).
create or replace function public.record_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text default null,
  p_bank_account_id uuid default null
) returns public.payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions;
  v_already_paid numeric(10,2);
  v_payment public.payments;
begin
  select * into v_subscription
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  if v_subscription.status not in ('pending_payment', 'scheduled') then
    raise exception 'Esta suscripción no puede recibir pagos en su estado actual';
  end if;

  select coalesce(sum(amount), 0) into v_already_paid
  from public.payments
  where subscription_id = p_subscription_id;

  if v_already_paid + p_amount > v_subscription.final_price then
    raise exception 'El monto supera el saldo pendiente de la suscripción';
  end if;

  insert into public.payments (subscription_id, amount, payment_method, received_by, notes, bank_account_id)
  values (p_subscription_id, p_amount, p_method, auth.uid(), p_notes, p_bank_account_id)
  returning * into v_payment;

  if v_subscription.status = 'pending_payment'
     and v_already_paid + p_amount >= v_subscription.final_price then
    update public.subscriptions
    set status = 'active'
    where id = p_subscription_id;
  end if;

  return v_payment;
end;
$$;

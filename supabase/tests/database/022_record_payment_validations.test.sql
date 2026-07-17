-- supabase/tests/database/022_record_payment_validations.test.sql
--
-- Covers the two guards migration 0022 added to record_payment: rejecting a
-- payment that would push total paid past final_price, and rejecting any
-- payment on a subscription whose status isn't pending_payment/scheduled.
-- The happy-path activation behavior is already covered by
-- 008_subscription_rpcs.test.sql; this file only exercises the new guards.
--
-- plan(3) -> plan(5): +2 for migration 0038's p_payment_date param --
-- a backdated payment must be stored with the given date (not today's),
-- and a future-dated one must be rejected by the new guard.
begin;
select plan(5);

select tests.create_supabase_user('staff1@example.test', 'staff1@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('staff1@example.test');
select tests.authenticate_as('staff1@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'PAY-GUARD-CLIENT-1', 'Pay', 'Guard');
select tests.create_plan('Pay Guard Plan', 100000, 'month', 1);

select is(
  (select status from public.create_subscription(
    (select id from public.clients where dni_number = 'PAY-GUARD-CLIENT-1'),
    (select id from public.plans where name = 'Pay Guard Plan'),
    public.today_bogota(),
    0
  )),
  'pending_payment',
  'create_subscription with start_date=today yields pending_payment'
);

-- a payment larger than the remaining balance must be rejected
select throws_ok(
  $$ select public.record_payment(
       (select id from public.subscriptions
          where client_id = (select id from public.clients where dni_number = 'PAY-GUARD-CLIENT-1')),
       150000, 'cash', 'too much'
     ) $$,
  'P0001',
  'El monto supera el saldo pendiente de la suscripción',
  'record_payment refuses an amount larger than the subscription balance'
);

-- payment_date defaults to today when omitted (still pending_payment,
-- balance untouched by the rejected overpayment attempt above), but a past
-- date can be given for a late entry -- the RPC stores that date as-is.
select is(
  (
    select payment_date::date
    from public.record_payment(
      (select id from public.subscriptions
         where client_id = (select id from public.clients where dni_number = 'PAY-GUARD-CLIENT-1')),
      30000, 'cash', 'backdated payment', null, current_date - 1
    )
  ),
  current_date - 1,
  'record_payment stores the given payment_date instead of defaulting to today'
);

-- a future payment_date must be rejected
select throws_ok(
  $$ select public.record_payment(
       (select id from public.subscriptions
          where client_id = (select id from public.clients where dni_number = 'PAY-GUARD-CLIENT-1')),
       10000, 'cash', 'future dated', null, current_date + 1
     ) $$,
  'P0001',
  'La fecha del pago no puede ser posterior a hoy',
  'record_payment refuses a payment_date in the future'
);

-- once canceled, the subscription can no longer take a payment
select public.cancel_subscription(
  (select id from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'PAY-GUARD-CLIENT-1')),
  'test cancellation'
);

select throws_ok(
  $$ select public.record_payment(
       (select id from public.subscriptions
          where client_id = (select id from public.clients where dni_number = 'PAY-GUARD-CLIENT-1')),
       100000, 'cash', 'late payment attempt'
     ) $$,
  'P0001',
  'Esta suscripción no puede recibir pagos en su estado actual',
  'record_payment refuses a payment on a canceled subscription'
);

select * from finish();
rollback;

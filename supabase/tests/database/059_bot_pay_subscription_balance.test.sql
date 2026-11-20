-- supabase/tests/database/059_bot_pay_subscription_balance.test.sql
begin;
select plan(18);

update public.plans set slug = null, is_active = false;
select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
update public.plan_prices set valid_from = public.today_bogota() - 400 where plan_id = (select id from public.plans where slug = 'mensualidad');
create temp table n as select (select number from public.plans where slug = 'mensualidad') as pm;

-- Fulanita abonó 40.000 de una mensualidad de 50.000
select public.bot_register_payment(null, 'Fulanita Saldo', 'EFECTIVO',
  format('[{"kind":"membership","amount":40000,"expected":50000,"plan_number":%s}]', (select pm from n))::jsonb,
  'Betty', 'Fulanita abonó 40 mil');
create temp table f as select number as cn from public.clients where first_name = 'Fulanita' order by created_at desc limit 1;

select is(public.bot_client_balance((select cn from f)), 10000.00, 'el abono deja 10.000 de saldo');
select is(jsonb_array_length(public.bot_client_debts((select cn from f))), 1, 'bot_client_debts lista el saldo de la membresía');
select is(public.bot_client_debts((select cn from f))->0->>'concepto', 'Saldo de Mensualidad', 'con el nombre del plan');

-- pagar los 10.000: es un pago más de la membresía y la deja activa
select public.bot_pay_debt((select cn from f), 10000, 'EFECTIVO', 'Betty', 'Fulanita pagó 10 mil');
select is(
  (select s.status from public.subscriptions s join public.clients c on c.id = s.client_id where c.number = (select cn from f)),
  'active', 'la membresía queda activa al completar el pago');
select is((select count(*)::int from public.payments p join public.subscriptions s on s.id = p.subscription_id
           join public.clients c on c.id = s.client_id where c.number = (select cn from f)), 2, 'son dos pagos de la misma membresía');
select is(public.bot_client_balance((select cn from f)), 0.00, 'ya no debe nada');

-- anular ese pago deja la membresía pendiente otra vez
select public.bot_void((select p.number from public.payments p where p.original_message = 'Fulanita pagó 10 mil'), 'Betty', 'prueba');
select is(public.bot_client_balance((select cn from f)), 10000.00, 'anular el pago devuelve el saldo');

-- deuda suelta (más vieja) + saldo de membresía: un solo pago los cubre en orden
select public.bot_register_debt((select cn from f), null, 6900, 'Deuda general', 'Betty', 'Fulanita debe 6900');
update public.debts set created_at = now() - interval '1 day'
  where client_id = (select id from public.clients where number = (select cn from f));
select is(public.bot_client_balance((select cn from f)), 16900.00, 'saldo = membresía + deuda suelta');
select public.bot_pay_debt((select cn from f), 8000, 'NEQUI', 'Betty', 'Fulanita pagó 8 mil');
select is(
  (select d.status || ':' || d.paid_amount from public.debts d join public.clients c on c.id = d.client_id where c.number = (select cn from f)),
  'paid:6900.00', 'primero se salda la deuda suelta, que era la más vieja');
select is(public.bot_client_balance((select cn from f)), 8900.00, 'y el resto va a la membresía (queda 8.900)');
select throws_like(
  format($$select public.bot_pay_debt(%s, 99999, 'EFECTIVO', 'Betty', 'x')$$, (select cn from f)),
  '%supera lo que debe%', 'no acepta pagar de más');

-- anular el pago de una deuda suelta avisa cuánto se reabrió
select public.bot_register_debt(null, 'Reabre Prueba', 6900, 'Deuda general', 'Betty', 'Reabre debe 6900');
create temp table rb as select number as cn from public.clients where first_name = 'Reabre' order by created_at desc limit 1;
select public.bot_pay_debt((select cn from rb), 6900, 'EFECTIVO', 'Betty', 'Reabre pagó 6900');
create temp table rbv as
  select public.bot_void((select number from public.product_sales where original_message = 'Reabre pagó 6900'), 'Betty', 'prueba') as r;
select is((select (r->>'debt_reopened')::numeric from rbv), 6900.00, 'anular el pago de una deuda dice cuánto se reabrió');
select is(public.bot_client_balance((select cn from rb)), 6900.00, 'y la deuda vuelve a estar pendiente');

-- membresías encadenadas: al anular el pago de la primera, la siguiente se corre hacia atrás
select public.bot_register_payment(null, 'Cadena Prueba', 'EFECTIVO',
  format('[{"kind":"membership","amount":50000,"expected":50000,"plan_number":%s}]', (select pm from n))::jsonb,
  'Betty', 'Cadena pagó mensualidad');
create temp table ch as select s.id as sid, s.client_id as cid, s.start_date as sd, s.end_date as ed
  from public.subscriptions s join public.clients c on c.id = s.client_id
  where c.first_name = 'Cadena' order by s.created_at desc limit 1;
select public.renew_subscription((select sid from ch));
select is((select count(*)::int from public.subscriptions where client_id = (select cid from ch) and status = 'scheduled'),
  1, 'la renovación queda programada');
create temp table chv as
  select public.bot_void((select p.number from public.payments p where p.original_message = 'Cadena pagó mensualidad'), 'Betty', 'prueba') as r;
select is((select (r->>'dates_recalculated')::int from chv), 1, 'anular la primera corre una membresía posterior');
select is((select start_date from public.subscriptions where client_id = (select cid from ch) and status = 'pending_payment'),
  (select sd from ch), 'la siguiente pasa a empezar donde empezaba la anulada');
select is((select count(*)::int from public.subscriptions where client_id = (select cid from ch) and status = 'canceled'), 1, 'la primera queda cancelada');
select is((select (r->>'later_subscriptions')::boolean from chv), false, 'ya no avisa de fechas sin recalcular');

select * from finish();
rollback;

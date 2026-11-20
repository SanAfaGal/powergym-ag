-- supabase/tests/database/058_bot_debt_payments.test.sql
begin;
select plan(13);

-- un cliente con dos deudas sueltas: 6.900 (vieja) y 5.000 (agua)
select public.bot_register_debt(null, 'Deudor Prueba', 6900, 'Deuda general', 'Betty', 'Deudor debe 6900');
create temp table n as select number as cn from public.clients where first_name = 'Deudor' order by created_at desc limit 1;
-- la base de pruebas puede traer pagos de hoy (seed): el cierre se compara contra lo que ya había
create temp table antes as select coalesce((public.bot_daily_close()->>'total_general')::numeric, 0) as total;
select public.bot_register_debt((select cn from n), null, 5000, 'agua', 'Betty', 'Deudor debe 5000');

select is(jsonb_array_length(public.bot_client_debts((select cn from n))), 2, 'bot_client_debts lista las dos deudas pendientes');
select is(public.bot_client_balance((select cn from n)), 11900.00, 'el saldo suma las dos deudas');

-- pagar 6.900: se aplica a la más vieja y la salda
select public.bot_pay_debt((select cn from n), 6900, 'EFECTIVO', 'Betty', 'Deudor pagó 6900');
select is(
  (select string_agg(d.status || ':' || d.paid_amount, ',' order by d.number)
   from public.debts d join public.clients c on c.id = d.client_id where c.number = (select cn from n)),
  'paid:6900.00,pending:0.00', 'el pago salda la deuda más vieja y deja la otra');
select is(public.bot_client_balance((select cn from n)), 5000.00, 'el saldo baja');
select is((public.bot_daily_close()->>'total_general')::numeric - (select total from antes), 6900.00, 'el dinero recibido entra al cierre de caja');
select is(
  (select ps.description from public.product_sales ps where ps.original_message = 'Deudor pagó 6900'),
  'Pago de deuda', 'queda registrado como "Pago de deuda" con su número P');

-- abono parcial
select public.bot_pay_debt((select cn from n), 2000, 'NEQUI', 'Betty', 'Deudor abonó 2000');
select is(public.bot_client_balance((select cn from n)), 3000.00, 'un abono parcial deja el resto como saldo');
select is(
  (select (x->>'total_debe')::numeric from jsonb_array_elements(public.bot_debtors()) x
   where (x->>'cliente_id')::bigint = (select cn from n)),
  3000.00, 'deudores muestra el saldo, no el monto original');

-- no se acepta pagar de más ni pagar sin deuda
select throws_like(
  format($$select public.bot_pay_debt(%s, 99999, 'EFECTIVO', 'Betty', 'x')$$, (select cn from n)),
  '%supera lo que debe%', 'no acepta pagar más de lo que debe');

-- anular el primer pago reabre su deuda
select public.bot_void((select number from public.product_sales where original_message = 'Deudor pagó 6900'), 'Betty', 'prueba');
select is(
  (select string_agg(d.status || ':' || d.paid_amount, ',' order by d.number)
   from public.debts d join public.clients c on c.id = d.client_id where c.number = (select cn from n)),
  'pending:0.00,pending:2000.00', 'anular el pago reabre la deuda');
select is(public.bot_client_balance((select cn from n)), 9900.00, 'y el saldo vuelve a subir');

select public.bot_pay_debt((select cn from n), 9900, 'EFECTIVO', 'Betty', 'Deudor saldó todo');
select throws_like(
  format($$select public.bot_pay_debt(%s, 1, 'EFECTIVO', 'Betty', 'x')$$, (select cn from n)),
  '%no tiene deudas pendientes%', 'sin deudas no hay nada que pagar');
select is(public.bot_client_balance((select cn from n)), 0.00, 'saldada del todo');

select * from finish();
rollback;

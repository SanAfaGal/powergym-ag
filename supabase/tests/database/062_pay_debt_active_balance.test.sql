-- supabase/tests/database/062_pay_debt_active_balance.test.sql
begin;
select plan(5);

update public.plans set slug = null, is_active = false;
select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
update public.plan_prices set valid_from = public.today_bogota() - 400 where plan_id = (select id from public.plans where slug = 'mensualidad');
create temp table n as select (select number from public.plans where slug = 'mensualidad') as pm;

-- abonó 30.000 de 50.000 y la membresía quedó "activa" (como los datos de ejemplo)
select public.bot_register_payment(null, 'Activa Saldo', 'EFECTIVO',
  format('[{"kind":"membership","amount":30000,"expected":50000,"plan_number":%s}]', (select pm from n))::jsonb,
  'Betty', 'Activa Saldo abonó 30 mil');
create temp table f as select number as cn, id as cid from public.clients where first_name = 'Activa' order by created_at desc limit 1;
update public.subscriptions set status = 'active' where client_id = (select cid from f);

select is(public.bot_client_balance((select cn from f)), 20000.00, 'la membresía activa con saldo cuenta como deuda');

select lives_ok(
  format('select public.bot_pay_debt(%s, 20000, ''EFECTIVO'', ''Betty'', ''Activa Saldo pagó 20 mil'')', (select cn from f)),
  'se puede pagar el saldo de una membresía activa');
select is(public.bot_client_balance((select cn from f)), 0.00, 'ya no debe nada');
select is((select status::text from public.subscriptions where client_id = (select cid from f)), 'active',
  'la membresía queda activa');
select is((select count(*)::int from public.payments p join public.subscriptions s on s.id = p.subscription_id
           where s.client_id = (select cid from f)), 2, 'son dos pagos de la misma membresía');

select * from finish();
rollback;

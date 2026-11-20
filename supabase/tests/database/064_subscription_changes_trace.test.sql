-- supabase/tests/database/064_subscription_changes_trace.test.sql
begin;
select plan(6);

update public.plans set slug = null, is_active = false;
select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
update public.plan_prices set valid_from = public.today_bogota() - 400 where plan_id = (select id from public.plans where slug = 'mensualidad');
create temp table n as select (select number from public.plans where slug = 'mensualidad') as pm;

-- abona 30.000 de 50.000: la membresía queda pendiente de pago
select public.bot_register_payment(null, 'Cambios Sub', 'EFECTIVO',
  format('[{"kind":"membership","amount":30000,"expected":50000,"plan_number":%s}]', (select pm from n))::jsonb,
  'Betty', 'Cambios Sub abonó 30 mil');
create temp table c as select number as cn, id as cid from public.clients where first_name = 'Cambios';

select is((select count(*)::int from public.events where type = 'SUBSCRIPTION_UPDATED' and client_id = (select cid from c)), 0,
  'crear la membresía no cuenta como cambio');

-- completa el pago: pasa a activa y queda el evento con quién lo hizo
select public.bot_pay_debt((select cn from c), 20000, 'EFECTIVO', 'Guillén', 'Cambios Sub pagó 20 mil');
select is((select data->'cambios'->'estado'->>1 from public.events where type = 'SUBSCRIPTION_UPDATED' and client_id = (select cid from c)
           order by id desc limit 1), 'active', 'completar el pago deja el cambio de estado a activa');
select is((select reported_by from public.events where type = 'SUBSCRIPTION_UPDATED' and client_id = (select cid from c)
           order by id desc limit 1), 'Guillén', 'con quién lo provocó');
select is((select source from public.events where type = 'SUBSCRIPTION_UPDATED' and client_id = (select cid from c)
           order by id desc limit 1), 'whatsapp', 'por WhatsApp');

-- anular el último pago la devuelve a pendiente
select public.bot_void((select p.number from public.payments p where p.original_message = 'Cambios Sub pagó 20 mil'), 'Betty', 'prueba');
select is((select data->'cambios'->'estado'->>1 from public.events where type = 'SUBSCRIPTION_UPDATED' and client_id = (select cid from c)
           order by id desc limit 1), 'pending_payment', 'anular el pago deja el cambio de vuelta a pendiente');
select is((select reported_by from public.events where type = 'SUBSCRIPTION_UPDATED' and client_id = (select cid from c)
           order by id desc limit 1), 'Betty', 'con quién anuló');

select * from finish();
rollback;

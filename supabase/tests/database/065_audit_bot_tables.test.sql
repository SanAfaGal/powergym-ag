-- supabase/tests/database/065_audit_bot_tables.test.sql
--
-- Migración 0065: las tablas de dinero del bot quedan en audit_log, y el bot sigue registrando pagos con los
-- triggers de auditoría de la migración 0053 puestos en payments y subscriptions (los dos juntos).
begin;
select plan(7);

select is(
  (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and t.tgname like 'audit\_%' escape '\'
     and c.relname in ('debts', 'debt_payments', 'voided_payments', 'product_sales', 'products')),
  5, 'las 5 tablas de dinero del bot tienen su trigger de auditoría');

select is(
  (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and t.tgname like 'audit\_%' escape '\'
     and c.relname in ('whatsapp_messages', 'pending_actions', 'clarifications', 'events')),
  0, 'las tablas de trabajo del bot no se auditan');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'AUD-1', 'Aud', 'Deuda');
insert into public.debts (client_id, amount, concept, reported_by)
select id, 7000, 'agua', 'Betty' from public.clients where dni_number = 'AUD-1';
update public.debts set status = 'paid' where concept = 'agua';

select is(
  (select count(*)::int from public.audit_log where table_name = 'debts' and action = 'INSERT'
     and new_data ->> 'reported_by' = 'Betty' and actor_id is null),
  1, 'crear una deuda queda en audit_log, sin usuario y con quién la reportó');
select is(
  (select count(*)::int from public.audit_log where table_name = 'debts' and action = 'UPDATE'
     and old_data ->> 'status' = 'pending' and new_data ->> 'status' = 'paid'),
  1, 'cambiar el estado de una deuda queda con el antes y el después');

-- el bot registra un pago completo con los dos juegos de triggers puestos (los de 0053 y los de events)
update public.plans set slug = null, is_active = false;
select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
update public.plan_prices set valid_from = public.today_bogota() - 400
  where plan_id = (select id from public.plans where slug = 'mensualidad');
create temp table n as select (select number from public.plans where slug = 'mensualidad') as pm;

select public.bot_register_payment(null, 'Aud Pago', 'EFECTIVO',
  format('[{"kind":"membership","amount":50000,"plan_number":%s}]', (select pm from n))::jsonb,
  'Guillén', 'Aud Pago pagó mensualidad');

select is(
  (select count(*)::int from public.audit_log where table_name = 'payments' and action = 'INSERT'
     and new_data ->> 'reported_by' = 'Guillén'),
  1, 'un pago hecho por el bot queda en audit_log (trigger de 0053) con quién lo reportó');
select cmp_ok(
  (select count(*)::int from public.audit_log where table_name = 'subscriptions'
     and new_data ->> 'status' = 'active'),
  '>=', 1, 'la membresía creada por el bot también queda en audit_log');
select is(
  (select count(*)::int from public.events where type = 'PAYMENT_RECEIVED' and reported_by = 'Guillén'),
  1, 'y el evento del bot (events) sigue registrándose');

select * from finish();
rollback;

-- supabase/tests/database/054_whatsapp_bot.test.sql
--
-- Migración 0054: número corto compartido, origen del pago y anulación (void_payment).
begin;
select plan(7);

select tests.create_supabase_user('bot-admin@example.test', 'bot-admin@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('bot-admin@example.test');
select tests.authenticate_as('bot-admin@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'BOT-CLIENT-1', 'Bot', 'Cliente');
select tests.create_plan('Bot Plan', 100000, 'month', 1);

select public.create_subscription(
  (select id from public.clients where dni_number = 'BOT-CLIENT-1'),
  (select id from public.plans where name = 'Bot Plan'),
  public.today_bogota(), 0
);

-- 1-2: un pago del bot guarda su origen y recibe un número corto
select public.record_payment(
  (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'BOT-CLIENT-1')),
  100000, 'cash', null, null, null, 'Guillén', 'whatsapp', 'Bot pagó mensualidad'
);

select is(
  (select reported_by || '/' || source from public.payments where original_message = 'Bot pagó mensualidad'),
  'Guillén/whatsapp',
  'record_payment guarda quién lo reportó y el origen'
);
select ok(
  (select number from public.payments where original_message = 'Bot pagó mensualidad') is not null,
  'el pago recibe un número corto'
);

-- 3: la suscripción quedó activa
select is(
  (select status from public.subscriptions where client_id = (select id from public.clients where dni_number = 'BOT-CLIENT-1')),
  'active',
  'el pago completo activa la suscripción'
);

-- 4-6: anular el pago lo saca de payments, lo archiva y cancela la suscripción
select is(
  (select (public.void_payment(
     (select number from public.payments where original_message = 'Bot pagó mensualidad'),
     'Betty', 'lo registraron dos veces'
   ))->>'subscription_canceled'),
  'true',
  'void_payment cancela la suscripción que ese pago había activado'
);
select is(
  (select count(*)::int from public.payments where original_message = 'Bot pagó mensualidad'),
  0,
  'el pago anulado ya no está en payments (los totales lo excluyen solos)'
);
select is(
  (select voided_by || '/' || void_reason from public.voided_payments where original_message = 'Bot pagó mensualidad'),
  'Betty/lo registraron dos veces',
  'el pago anulado queda archivado con quién y por qué'
);

-- 7: anular un número que no existe da un mensaje claro
select throws_ok(
  $$ select public.void_payment(999999999, 'Betty') $$,
  'P0001',
  'No encuentro el pago P999999999',
  'void_payment avisa si el número no existe'
);

select * from finish();
rollback;

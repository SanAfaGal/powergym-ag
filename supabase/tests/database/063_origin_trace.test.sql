-- supabase/tests/database/063_origin_trace.test.sql
begin;
select plan(12);

select tests.create_supabase_user('traza-staff@example.test', 'traza-staff@example.test');
update public.profiles set full_name = 'Staff Traza' where id = tests.get_supabase_uid('traza-staff@example.test');

update public.plans set slug = null, is_active = false;
select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
update public.plan_prices set valid_from = public.today_bogota() - 400 where plan_id = (select id from public.plans where slug = 'mensualidad');
create temp table n as select (select number from public.plans where slug = 'mensualidad') as pm;

-- 1) cliente y membresía creados por el bot: quedan con quién lo reportó y el mensaje
select public.bot_register_payment(null, 'Traza Bot', 'EFECTIVO',
  format('[{"kind":"membership","amount":50000,"plan_number":%s}]', (select pm from n))::jsonb,
  'Betty', 'Traza Bot pagó 50 mil');
create temp table cb as select id from public.clients where first_name = 'Traza' and last_name = 'Bot';

select is((select count(*)::int from public.events where type = 'CLIENT_CREATED' and client_id = (select id from cb)), 1,
  'el cliente creado por el bot deja un evento');
select is((select source from public.events where type = 'CLIENT_CREATED' and client_id = (select id from cb)), 'whatsapp',
  'el evento del cliente dice que vino de WhatsApp');
select is((select reported_by from public.events where type = 'CLIENT_CREATED' and client_id = (select id from cb)), 'Betty',
  'guarda quién lo reportó');
select is((select original_message from public.events where type = 'CLIENT_CREATED' and client_id = (select id from cb)), 'Traza Bot pagó 50 mil',
  'guarda el mensaje original');
select is((select count(*)::int from public.events where type = 'SUBSCRIPTION_CREATED' and client_id = (select id from cb)
           and subscription_id is not null and source = 'whatsapp' and original_message = 'Traza Bot pagó 50 mil'), 1,
  'la membresía creada por el bot deja su evento con el mensaje');

-- 2) cliente creado por bot_create_client (sin pago)
select public.bot_create_client('Traza Solo', null, 'Guillén', 'cliente nuevo Traza Solo');
select is((select reported_by from public.events where type = 'CLIENT_CREATED' and data->>'nombre' = 'Traza Solo'), 'Guillén',
  'bot_create_client también guarda quién lo reportó');

-- 3) desde el panel: un usuario con sesión
-- (en producción cada petición es su propia transacción; aquí el bot y el panel comparten una sola, así que
--  se borra el origen que dejó el bot para simular la petición siguiente)
select set_config('app.origin', '', true);
select tests.authenticate_as('traza-staff@example.test');
insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'TRAZA-1', 'Traza', 'Panel');
select is((select source from public.events where type = 'CLIENT_CREATED' and data->>'nombre' = 'Traza Panel'), 'panel',
  'un cliente creado en el panel queda como panel');
select is((select reported_by from public.events where type = 'CLIENT_CREATED' and data->>'nombre' = 'Traza Panel'), 'Staff Traza',
  'con el nombre de quien lo creó');
select is((select original_message from public.events where type = 'CLIENT_CREATED' and data->>'nombre' = 'Traza Panel'), null,
  'sin mensaje original');

-- 4) editar un cliente deja qué cambió
update public.clients set phone = '3001234567' where dni_number = 'TRAZA-1';
select is((select data->'cambios'->'phone'->>1 from public.events where type = 'CLIENT_UPDATED'
           and client_id = (select id from public.clients where dni_number = 'TRAZA-1')), '3001234567',
  'editar un cliente deja el cambio con el valor nuevo');
select is((select reported_by from public.events where type = 'CLIENT_UPDATED'
           and client_id = (select id from public.clients where dni_number = 'TRAZA-1')), 'Staff Traza',
  'y quién lo editó');

-- 5) una edición que no cambia nada no deja evento
update public.clients set phone = '3001234567' where dni_number = 'TRAZA-1';
select is((select count(*)::int from public.events where type = 'CLIENT_UPDATED'
           and client_id = (select id from public.clients where dni_number = 'TRAZA-1')), 1,
  'guardar sin cambios no deja evento');

select * from finish();
rollback;

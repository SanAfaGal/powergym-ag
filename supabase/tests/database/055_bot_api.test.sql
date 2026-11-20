-- supabase/tests/database/055_bot_api.test.sql
--
-- Migración 0055: funciones que usa el bot (bot_*). Se llaman sin cambiar de rol: son
-- security definer y en producción solo las puede ejecutar la service key.
begin;
select plan(16);

-- Si la base local ya tiene planes/productos reales (mismo slug o nombre), se apartan dentro de esta
-- transacción para que no choquen con los del test. Todo se deshace al terminar: no toca tus datos.
update public.plans set slug = null, is_active = false;
update public.products set name = name || ' (real)', is_active = false;
-- lo que ya hubiera registrado hoy en la base: los conteos del test se miden sobre esto
create temp table base as select (public.bot_daily_close()->>'cantidad_pagos')::int as pagos;

select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
select public.create_plan('Quincena', 30000, 'day', 15, null, 'quincena');
insert into public.products (name, reference_price) values ('Agua', 2500);

-- los números salen de una secuencia que otros tests ya avanzaron: nunca se asume su valor
create temp table n as select
  (select number from public.plans where slug = 'mensualidad') as pm,
  (select number from public.products where name = 'Agua') as agua,
  (public.bot_create_client('Camilo Prueba Nuevo', '3001112222')->>'number')::bigint as camilo,
  (public.bot_create_client('Madonna')->>'number')::bigint as madonna,
  (public.bot_create_client('Pedro Ruiz')->>'number')::bigint as pedro;

-- 1-2: catálogo y clientes con los nombres que usa el agente
select is(
  (select jsonb_agg(p->>'name' order by (p->>'number')::int) from jsonb_array_elements(public.bot_catalog()->'plans') p),
  '["MENSUALIDAD", "QUINCENA"]'::jsonb,
  'el catálogo nombra los planes por su slug en mayúsculas'
);
select is(
  (select p->>'name' from jsonb_array_elements(public.bot_clients()) p where (p->>'number')::bigint = (select camilo from n)),
  'Camilo Prueba Nuevo',
  'bot_clients entrega el nombre completo con su número'
);

-- 3-5: pago completo activa la membresía y queda con origen WhatsApp
select public.bot_register_payment((select camilo from n), null, 'EFECTIVO',
  format('[{"kind":"membership","amount":50000,"plan_number":%s}]', (select pm from n))::jsonb, 'Guillén', 'Camilo pagó mensualidad');
select is(public.bot_membership_state((select camilo from n))->>'estado', 'ACTIVA', 'el pago completo deja la membresía activa');
select is(
  (select source || '/' || reported_by from public.payments where original_message = 'Camilo pagó mensualidad'),
  'whatsapp/Guillén', 'el pago guarda origen y quién lo reportó'
);
select is(public.bot_membership_state((select camilo from n))->>'tipo_membresia', 'MENSUALIDAD', 'el estado dice el tipo con el nombre del agente');

-- 6: renovar encadena: empieza el día siguiente al fin de la anterior
select public.bot_register_payment((select camilo from n), null, 'NEQUI',
  format('[{"kind":"membership","amount":50000,"plan_number":%s}]', (select pm from n))::jsonb, 'Betty', 'renovó');
select is(
  (select count(*)::int from public.subscriptions s join public.clients c on c.id = s.client_id
     where c.number = (select camilo from n) and s.start_date = (select min(end_date) + 1 from public.subscriptions s2 where s2.client_id = c.id)),
  1, 'la renovación empieza el día siguiente al fin de la anterior'
);

-- 7: Nequi cuenta como transferencia
select is(
  (select payment_method from public.payments where original_message = 'renovó'),
  'bank', 'Nequi, Daviplata y QR se guardan como transferencia'
);

-- 8-9: pago mixto crea dos registros con números distintos
select is(
  jsonb_array_length(public.bot_register_payment(null, 'Laura Gómez', 'EFECTIVO',
    format('[{"kind":"membership","amount":50000,"plan_number":%s},{"kind":"product","amount":2500,"product_number":%s}]',
           (select pm from n), (select agua from n))::jsonb,
    'Nana', 'Laura pagó y agua')->'entries'),
  2, 'mensualidad + producto en un mensaje son dos registros'
);
select is(
  (select count(*)::int from public.clients where first_name = 'Laura' and last_name = 'Gómez'), 1,
  'si el cliente no existe se crea con el pago'
);

-- 10-11: pago parcial deja el saldo como deuda
select public.bot_register_payment((select madonna from n), null, 'EFECTIVO',
  format('[{"kind":"membership","amount":30000,"plan_number":%s,"expected":50000}]', (select pm from n))::jsonb, 'Guillén', 'Madonna abonó 30');
select is(public.bot_client_balance((select madonna from n)), 20000.00::numeric, 'el abono parcial deja el saldo pendiente');
select ok(
  exists (select 1 from jsonb_array_elements(public.bot_debtors()) d where d->>'cliente_nombre' = 'Madonna'),
  'quien debe sale en la lista de deudores'
);

-- 12: un monto menor al precio, sin "expected", es un descuento y deja la membresía activa
select public.bot_register_payment((select pedro from n), null, 'EFECTIVO',
  format('[{"kind":"membership","amount":40000,"plan_number":%s}]', (select pm from n))::jsonb, 'Guillén', 'Pedro 40');
select is(
  (select status from public.subscriptions s join public.clients c on c.id = s.client_id where c.number = (select pedro from n)),
  'active', 'pagar menos del precio sin pago parcial se toma como descuento'
);

-- 13: el cierre del día suma membresías y productos
select is(
  (public.bot_daily_close()->>'cantidad_pagos')::int, (select pagos + 6 from base),
  'el cierre cuenta pagos de membresía y ventas de productos'
);

-- 14-15: anular saca el pago de los totales y cancela la membresía
select public.bot_void((select number from public.payments where original_message = 'Pedro 40'), 'Betty', 'duplicado');
select is(public.bot_membership_state((select pedro from n))->>'estado', 'SIN_MEMBRESIA', 'anular cancela la membresía que había activado');
select is(
  (select a->>'anulado_por' from jsonb_array_elements(public.bot_day_report()->'anulados') a
    where (a->>'number')::bigint = (select number from public.voided_payments where original_message = 'Pedro 40')),
  'Betty', 'el reporte del día lista lo anulado y quién lo anuló'
);

-- 16: anular algo que ya estaba anulado avisa
select throws_ok(
  $$ select public.bot_void((select number from public.voided_payments where original_message = 'Pedro 40'), 'Betty') $$,
  'P0001', null, 'anular dos veces el mismo pago da error'
);

select * from finish();
rollback;

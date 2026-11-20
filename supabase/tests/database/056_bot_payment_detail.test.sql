-- supabase/tests/database/056_bot_payment_detail.test.sql
begin;
select plan(5);

-- se apartan planes/productos reales dentro de esta transacción (se deshace al terminar)
update public.plans set slug = null, is_active = false;
update public.products set name = name || ' (real)', is_active = false;

select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
insert into public.products (name, reference_price) values ('Agua', 2500);

create temp table n as select
  (select number from public.plans where slug = 'mensualidad') as pm,
  (select number from public.products where name = 'Agua') as agua;

select public.bot_register_payment(null, 'Detalle Prueba', 'NEQUI',
  format('[{"kind":"membership","amount":50000,"plan_number":%s},{"kind":"product","amount":2500,"product_number":%s}]',
         (select pm from n), (select agua from n))::jsonb,
  'Guillén', 'Detalle pagó mensualidad y agua');

select is(
  public.bot_payment_detail((select number from public.payments where original_message = 'Detalle pagó mensualidad y agua'))
    ->>'concepto', 'MENSUALIDAD', 'el detalle de un pago de membresía trae el plan');
select is(
  public.bot_payment_detail((select number from public.payments where original_message = 'Detalle pagó mensualidad y agua'))
    ->>'metodo', 'TRANSFERENCIA', 'Nequi se ve como transferencia');
select is(
  public.bot_payment_detail((select number from public.product_sales where original_message = 'Detalle pagó mensualidad y agua'))
    ->>'concepto', 'Agua', 'el detalle de una venta de producto trae el producto');

select public.bot_void((select number from public.payments where original_message = 'Detalle pagó mensualidad y agua'), 'Betty', 'duplicado');
select is(
  (select (d->>'anulado') || '/' || (d->>'anulado_por') || '/' || (d->>'motivo')
   from (select public.bot_payment_detail((select number from public.voided_payments where original_message = 'Detalle pagó mensualidad y agua')) as d) x),
  'true/Betty/duplicado', 'un pago anulado dice quién lo anuló y por qué');
select is(public.bot_payment_detail(999999999), null::jsonb, 'un número que no existe devuelve null');

select * from finish();
rollback;

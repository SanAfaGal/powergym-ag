-- supabase/tests/database/057_bot_start_date.test.sql
begin;
select plan(6);

update public.plans set slug = null, is_active = false;
select public.create_plan('Mensualidad', 50000, 'month', 1, null, 'mensualidad');
-- el precio rige desde hace tiempo (los pagos tardíos usan el precio de su fecha de inicio)
update public.plan_prices set valid_from = public.today_bogota() - 400 where plan_id = (select id from public.plans where slug = 'mensualidad');
create temp table n as select (select number from public.plans where slug = 'mensualidad') as pm;

-- pago tardío: la membresía empezó hace 10 días, el pago es de hoy
select public.bot_register_payment(null, 'Tardia Prueba', 'EFECTIVO',
  format('[{"kind":"membership","amount":50000,"plan_number":%s,"start_date":"%s"}]',
         (select pm from n), (public.today_bogota() - 10))::jsonb,
  'Guillén', 'Tardia pagó mensualidad inicio hace 10 días');

select is(
  (select s.start_date from public.subscriptions s join public.payments p on p.subscription_id = s.id
   where p.original_message = 'Tardia pagó mensualidad inicio hace 10 días'),
  public.today_bogota() - 10, 'la membresía empieza en la fecha indicada');
select is(
  (select p.payment_date::date from public.payments p where p.original_message = 'Tardia pagó mensualidad inicio hace 10 días'),
  public.today_bogota(), 'la fecha del pago sigue siendo hoy');
select is(
  (select s.status from public.subscriptions s join public.payments p on p.subscription_id = s.id
   where p.original_message = 'Tardia pagó mensualidad inicio hace 10 días'),
  'active', 'queda activa');

-- fecha futura
select throws_ok(
  format($$select public.bot_register_payment(null, 'Futura Prueba', 'EFECTIVO',
    '[{"kind":"membership","amount":50000,"plan_number":%s,"start_date":"%s"}]'::jsonb, 'Guillén', 'x')$$,
    (select pm from n), (public.today_bogota() + 3)),
  'La fecha de inicio no puede ser futura', 'no acepta inicio futuro');

-- ya vencería (inicio hace 60 días, mensualidad)
select throws_ok(
  format($$select public.bot_register_payment(null, 'Vencida Prueba', 'EFECTIVO',
    '[{"kind":"membership","amount":50000,"plan_number":%s,"start_date":"%s"}]'::jsonb, 'Guillén', 'x')$$,
    (select pm from n), (public.today_bogota() - 60)),
  'Con esa fecha de inicio la membresía ya estaría vencida; revísalo a mano', 'no acepta un inicio que ya venció');

-- se solapa con la membresía vigente de la misma persona
select throws_like(
  format($$select public.bot_register_payment(
      (select number from public.clients where first_name = 'Tardia' limit 1), null, 'EFECTIVO',
      '[{"kind":"membership","amount":50000,"plan_number":%s,"start_date":"%s"}]'::jsonb, 'Guillén', 'x')$$,
    (select pm from n), (public.today_bogota() - 5)),
  '%solapa%', 'no acepta un inicio que se solapa con la membresía vigente');

select * from finish();
rollback;

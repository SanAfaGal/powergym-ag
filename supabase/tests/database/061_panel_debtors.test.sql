-- supabase/tests/database/061_panel_debtors.test.sql
begin;
select plan(5);

select tests.create_supabase_user('deud-staff@example.test', 'deud-staff@example.test');
select tests.create_supabase_user('deud-inactivo@example.test', 'deud-inactivo@example.test');
update public.profiles set is_active = false where id = tests.get_supabase_uid('deud-inactivo@example.test');

-- Una clienta con una deuda suelta de 6.900 (de las que registra el bot)
select public.bot_register_debt(null, 'Deudora Panel', 6900, 'Deuda general', 'Betty', 'Deudora Panel debe 6900');

select tests.authenticate_as('deud-inactivo@example.test');
select throws_like('select * from public.panel_debtors()', '%Solo el staff activo%',
  'un staff inactivo no puede ver los deudores');

select tests.authenticate_as('deud-staff@example.test');
select is((select count(*)::int from public.panel_debtors() where first_name = 'Deudora'), 1,
  'la clienta con deuda aparece una sola vez');
select is((select total from public.panel_debtors() where first_name = 'Deudora'), 6900.00,
  'el total es la deuda suelta');
select is((select jsonb_array_length(detail) from public.panel_debtors() where first_name = 'Deudora'), 1,
  'el detalle trae una línea');
select is((select detail->0->>'concepto' from public.panel_debtors() where first_name = 'Deudora'), 'Deuda general',
  'con el concepto de la deuda');

select * from finish();
rollback;

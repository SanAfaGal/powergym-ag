-- supabase/tests/database/060_close_clarification.test.sql
begin;
select plan(5);

select tests.create_supabase_user('duda-staff@example.test', 'duda-staff@example.test');
select tests.create_supabase_user('duda-inactivo@example.test', 'duda-inactivo@example.test');
update public.profiles set is_active = false where id = tests.get_supabase_uid('duda-inactivo@example.test');

insert into public.clarifications (phone, original_message, question, reported_by)
values ('573000000000', 'Anular pago Laura', '¿Cuál es el problema?', 'Camila');
create temp table d as select max(id) as id from public.clarifications where original_message = 'Anular pago Laura';
grant select on d to authenticated;

-- un staff inactivo no puede cerrarla
select tests.authenticate_as('duda-inactivo@example.test');
select throws_like(
  format('select public.close_clarification(%s)', (select id from d)),
  '%Solo el staff activo%', 'un staff inactivo no puede cerrar una duda');

-- un staff activo sí
select tests.authenticate_as('duda-staff@example.test');
select public.close_clarification((select id from d));
select is((select status::text from public.clarifications where id = (select id from d)), 'resolved', 'la duda queda resuelta');
select ok((select answer like '(cerrada desde el panel por %' from public.clarifications where id = (select id from d)),
  'queda anotado que se cerró desde el panel');
select ok((select resolved_at is not null from public.clarifications where id = (select id from d)), 'guarda cuándo se resolvió');

-- cerrarla otra vez falla
select throws_like(
  format('select public.close_clarification(%s)', (select id from d)),
  '%ya estaba resuelta%', 'cerrar una duda ya resuelta falla');

select * from finish();
rollback;

-- supabase/tests/database/015_drop_client_middle_name_second_last_name.test.sql
begin;
select plan(3);

select hasnt_column('public', 'clients', 'middle_name', 'clients no longer has middle_name');
select hasnt_column('public', 'clients', 'second_last_name', 'clients no longer has second_last_name');

select lives_ok(
  $$ insert into public.clients (first_name, last_name)
     values ('Juan Carlos', 'Perez Gomez') $$,
  'multiple first/last names fit in first_name/last_name, space-separated'
);

select * from finish();
rollback;

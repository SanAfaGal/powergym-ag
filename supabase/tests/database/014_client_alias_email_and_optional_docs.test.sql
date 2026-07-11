-- supabase/tests/database/014_client_alias_email_and_optional_docs.test.sql
--
-- Covers migration 0014: clients.alias/email, and dni_type/dni_number
-- demoted from required to optional. Every assertion passes an explicit
-- description (see 003_clients.test.sql for why that matters with pgtap
-- 1.3.3 installed in this project).
begin;
select plan(7);

select has_column('public', 'clients', 'alias', 'clients has an alias column');
select has_column('public', 'clients', 'email', 'clients has an email column');

select isnt(
  (select attnotnull from pg_attribute
     where attrelid = 'public.clients'::regclass and attname = 'dni_type'),
  true,
  'clients.dni_type is nullable (optional per schema decision)'
);
select isnt(
  (select attnotnull from pg_attribute
     where attrelid = 'public.clients'::regclass and attname = 'dni_number'),
  true,
  'clients.dni_number is nullable (optional per schema decision)'
);

select lives_ok(
  $$ insert into public.clients (first_name, last_name, alias, email)
     values ('Sin Documento', 'Todavia', 'Sindoc', 'sindoc@example.test') $$,
  'a client can be created with only a name (no document)'
);

select throws_ok(
  $$ insert into public.clients (dni_type, dni_number, first_name, last_name)
     values ('CC', 'DUP-DNI-1', 'Client', 'One'), ('CC', 'DUP-DNI-1', 'Client', 'Two') $$,
  '23505',
  null,
  'two clients with the same non-null dni_number still violate uniqueness'
);

select lives_ok(
  $$ insert into public.clients (first_name, last_name)
     values ('No Doc', 'One'), ('No Doc', 'Two') $$,
  'two clients with a null dni_number do not violate uniqueness (NULLs are distinct)'
);

select * from finish();
rollback;

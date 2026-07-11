-- supabase/tests/database/003_clients.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument. This deviates from the brief's literal SQL (which omitted
-- descriptions), but is required for correctness: with pgtap 1.3.3 installed
-- in this project, has_table/col_is_pk/col_is_unique/col_not_null/has_index
-- all have same-arity overloads for both `(schema, table, ...)` and
-- `(table, ..., description)` forms. When called with untyped string
-- literals and no description, Postgres's unknown-literal resolution prefers
-- `text` (the preferred type for the string category) over `name`, so e.g.
-- `has_table('public', 'clients')` silently resolves to
-- `has_table(table_name => 'public', description => 'clients')` instead of
-- `has_table(schema => 'public', table => 'clients')` -- checking for a
-- table literally named "public" and always failing. Supplying a
-- description argument (as 002_profiles.test.sql already does) makes the
-- call match only the intended `(schema, table, ...)` overload.
begin;
select plan(6);

select has_table('public', 'clients', 'clients table exists');
select col_is_pk('public', 'clients', 'id', 'id is the primary key');
select col_is_unique('public', 'clients', 'dni_number', 'dni_number is unique');
select col_not_null('public', 'clients', 'first_name', 'first_name is not null');
-- phone is optional per the confirmed schema decision, must NOT be not-null
select isnt(
  (select attnotnull from pg_attribute
     where attrelid = 'public.clients'::regclass and attname = 'phone'),
  true,
  'clients.phone is nullable (optional per schema decision)'
);
select has_index('public', 'clients', 'clients_name_trgm_idx', 'clients_name_trgm_idx exists');

select * from finish();
rollback;

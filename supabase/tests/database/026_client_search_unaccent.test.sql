-- supabase/tests/database/026_client_search_unaccent.test.sql
--
-- Covers migration 0032: clients.search_text (generated, accent-stripped)
-- and its trigram index, replacing the plain first_name/last_name ilike
-- search that couldn't match "jose" against a stored "José". Every
-- assertion passes an explicit description (see 003_clients.test.sql for
-- why that matters with pgtap 1.3.3 installed in this project).
begin;
select plan(5);

select has_column('public', 'clients', 'search_text', 'clients has a search_text column');
select has_index('public', 'clients', 'clients_search_text_trgm_idx', 'clients_search_text_trgm_idx exists');

select is(
  public.f_unaccent('José'),
  'Jose',
  'f_unaccent strips accents'
);

select lives_ok(
  $$ insert into public.clients (first_name, last_name, alias, email)
     values ('José', 'Pérez', 'Pepe', 'jose@example.test') $$,
  'a client with accented name can be created'
);

select is(
  (select search_text from public.clients where first_name = 'José' and last_name = 'Pérez'),
  'jose perez pepe  jose@example.test',
  'search_text is lowercased, accent-stripped, and concatenates every searchable field'
);

select * from finish();
rollback;

-- supabase/migrations/00000000000032_client_search_unaccent.sql
--
-- listClients' search used ilike across first_name/last_name/dni_number/
-- alias/email -- case-insensitive but NOT accent-insensitive (Postgres
-- ilike compares raw bytes, so "jose" never matches "José"). alias/email
-- also had no index at all, only clients_name_trgm_idx (first_name ||
-- last_name) and clients_dni_trgm_idx covered part of the search surface.
--
-- Replaces both with one generated, indexed, accent-stripped column that
-- covers every searchable field. unaccent() itself isn't declared
-- immutable (it depends on a text search dictionary lookup), so it can't
-- be used directly in a generated column or index expression -- f_unaccent
-- wraps it as a strict immutable function, the standard workaround.

create extension if not exists unaccent;

create or replace function public.f_unaccent(text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select public.unaccent('unaccent', $1)
$$;

alter table public.clients add column search_text text
  generated always as (
    public.f_unaccent(lower(
      coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
      coalesce(alias, '') || ' ' || coalesce(dni_number, '') || ' ' ||
      coalesce(email, '')
    ))
  ) stored;

drop index if exists public.clients_name_trgm_idx;
drop index if exists public.clients_dni_trgm_idx;

create index clients_search_text_trgm_idx
  on public.clients using gin (search_text gin_trgm_ops);

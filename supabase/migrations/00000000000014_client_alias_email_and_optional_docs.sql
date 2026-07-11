-- supabase/migrations/00000000000014_client_alias_email_and_optional_docs.sql
--
-- Adds alias/email to clients, and demotes dni_type/dni_number from
-- required to optional -- staff can now register a client (e.g. for a
-- trial class) with just a name and fill in the document later. The
-- existing unique constraint on dni_number is unaffected: Postgres treats
-- NULLs as distinct for uniqueness purposes, so any number of clients
-- without a document number can coexist.

alter table public.clients
  add column alias text,
  add column email text;

alter table public.clients
  alter column dni_type drop not null,
  alter column dni_number drop not null;

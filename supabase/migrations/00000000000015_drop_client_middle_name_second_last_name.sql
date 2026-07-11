-- supabase/migrations/00000000000015_drop_client_middle_name_second_last_name.sql
--
-- Drops the dedicated middle_name/second_last_name columns. If a client has
-- more than one first name or surname, staff type them together in
-- first_name/last_name separated by a space (both already allow spaces) --
-- one field per "nombres"/"apellidos" concept, not one field per name.

alter table public.clients
  drop column middle_name,
  drop column second_last_name;

-- supabase/tests/database/041_access_control_schema.test.sql
--
-- Covers migration 0041: the biometric access-control tables. The point of
-- this file is less "do the tables exist" and more "who can touch them":
-- face_templates and biometric_consents must be unreachable for staff
-- (only the SECURITY DEFINER RPCs of later migrations may read or write
-- them), and access_events must be read-only for staff.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql
-- for why that matters with pgtap 1.3.3 installed in this project).
begin;
select plan(12);

select has_table('public', 'biometric_consents', 'biometric_consents exists');
select has_table('public', 'face_templates', 'face_templates exists');
select has_table('public', 'access_events', 'access_events exists');
select has_table('public', 'access_settings', 'access_settings exists');
select has_extension('vector', 'pgvector extension is installed');

select is(
  (select count(*) from public.access_settings),
  1::bigint,
  'access_settings is seeded with exactly one row'
);

-- still the migration-owning role here: the CHECK constraint is what's
-- under test, not the grants
select throws_ok(
  $$ insert into public.access_events (decision, reason_code)
     values ('maybe', 'ok') $$,
  '23514',
  null,
  'access_events.decision only accepts granted or denied'
);

select tests.create_supabase_user('access-staff@example.test', 'access-staff@example.test');
select tests.authenticate_as('access-staff@example.test');

select throws_ok(
  $$ select 1 from public.face_templates $$,
  '42501',
  null,
  'staff cannot read face_templates directly'
);

select throws_ok(
  $$ select 1 from public.biometric_consents $$,
  '42501',
  null,
  'staff cannot read biometric_consents directly'
);

select lives_ok(
  $$ select match_threshold, liveness_required from public.access_settings $$,
  'staff can read access_settings'
);

select lives_ok(
  $$ select id from public.access_events $$,
  'staff can read access_events'
);

select throws_ok(
  $$ insert into public.access_events (decision, reason_code)
     values ('granted', 'ok') $$,
  '42501',
  null,
  'staff cannot insert access_events directly'
);

select * from finish();
rollback;

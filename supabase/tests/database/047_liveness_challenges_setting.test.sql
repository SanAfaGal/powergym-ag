-- supabase/tests/database/047_liveness_challenges_setting.test.sql
--
-- Covers migration 0047: which liveness challenges the kiosk may ask for is an
-- admin setting (access_settings.liveness_challenges), changed through
-- update_access_settings(threshold, liveness_required, challenges). A NULL
-- challenges argument leaves the current list untouched, so older two-argument
-- calls keep working.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(9);

select matches(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'access_settings'
     and column_name = 'liveness_challenges'),
  'ARRAY\[''blink''.*''open_mouth''.*''smile''',
  'the default pool is the three expression challenges'
);

select doesnt_match(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'access_settings'
     and column_name = 'liveness_challenges'),
  'turn_any',
  'the head-turn challenge is off by default (a tilted photo can fake it)'
);

select tests.create_supabase_user('chal-staff@example.test', 'chal-staff@example.test');
select tests.create_supabase_user('chal-admin@example.test', 'chal-admin@example.test');
update public.profiles set role = 'admin'
  where id = tests.get_supabase_uid('chal-admin@example.test');

select tests.authenticate_as('chal-staff@example.test');

select lives_ok(
  $$ select liveness_challenges from public.access_settings $$,
  'staff can read the challenge pool'
);

select throws_ok(
  $$ select public.update_access_settings(0.5, true, array['blink']) $$,
  'P0001', 'admin only',
  'an employee cannot change the pool'
);

reset role;
select tests.authenticate_as('chal-admin@example.test');

select lives_ok(
  $$ select public.update_access_settings(0.5, true, array['blink', 'smile']) $$,
  'an admin can set the pool'
);

select is(
  (select liveness_challenges from public.access_settings),
  array['blink', 'smile']::text[],
  'the pool was stored'
);

select throws_ok(
  $$ select public.update_access_settings(0.5, true, array['blink', 'dance']) $$,
  'P0001', 'invalid challenges',
  'an unknown challenge name is rejected'
);

select throws_ok(
  $$ select public.update_access_settings(0.5, true, array[]::text[]) $$,
  'P0001', 'invalid challenges',
  'an empty pool is rejected while liveness is required'
);

select public.update_access_settings(0.5, true);
select is(
  (select liveness_challenges from public.access_settings),
  array['blink', 'smile']::text[],
  'omitting the pool keeps the current one'
);

select * from finish();
rollback;

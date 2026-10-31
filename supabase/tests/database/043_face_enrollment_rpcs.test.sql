-- supabase/tests/database/043_face_enrollment_rpcs.test.sql
--
-- Covers migration 0043: consent, enrollment and deletion of facial
-- templates. face_templates / biometric_consents are unreachable for staff
-- (migration 0041), so everything here goes through SECURITY DEFINER RPCs
-- with their own role guards. Rows are inspected between calls by dropping
-- back to the owning role with `reset role`.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(19);

-- unit vector along axis p: a valid 512-d embedding, distinct per p
create function pg_temp.vec(p integer) returns extensions.vector
language sql as $$
  select ('[' || string_agg(case when g = p then '1' else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 512) g
$$;

select has_function('public', 'grant_biometric_consent', 'grant_biometric_consent() exists');
select has_function('public', 'enroll_face', 'enroll_face() exists');
select has_function('public', 'delete_face_template', 'delete_face_template() exists');
select has_function('public', 'face_enrollment_status', 'face_enrollment_status() exists');

select tests.create_supabase_user('enroll-staff@example.test', 'enroll-staff@example.test');
select tests.create_supabase_user('enroll-admin@example.test', 'enroll-admin@example.test');
select tests.create_supabase_user('enroll-off@example.test', 'enroll-off@example.test');
update public.profiles set role = 'admin'
  where id = tests.get_supabase_uid('enroll-admin@example.test');
update public.profiles set is_active = false
  where id = tests.get_supabase_uid('enroll-off@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'ENROLL-1', 'Face', 'Client');

-- ---- employee (not admin) ----
select tests.authenticate_as('enroll-staff@example.test');

select throws_ok(
  $$ select public.enroll_face(
       (select id from public.clients where dni_number = 'ENROLL-1'),
       pg_temp.vec(1), 'auraface', 'v1', 0.9) $$,
  'P0001', 'consent required',
  'enrolling without a live consent is rejected'
);

select lives_ok(
  $$ select public.grant_biometric_consent(
       (select id from public.clients where dni_number = 'ENROLL-1'), '2026-10-v1') $$,
  'staff can record a biometric consent'
);

select is(
  public.grant_biometric_consent(
    (select id from public.clients where dni_number = 'ENROLL-1'), '2026-10-v1'),
  public.grant_biometric_consent(
    (select id from public.clients where dni_number = 'ENROLL-1'), '2026-10-v1'),
  'granting again returns the same live consent (idempotent)'
);

select lives_ok(
  $$ select public.enroll_face(
       (select id from public.clients where dni_number = 'ENROLL-1'),
       pg_temp.vec(1), 'auraface', 'v1', 0.9) $$,
  'staff can enroll a face once consent exists'
);

select is(
  (select has_template from public.face_enrollment_status(
     (select id from public.clients where dni_number = 'ENROLL-1'))),
  true,
  'status reports the template'
);

select public.enroll_face(
  (select id from public.clients where dni_number = 'ENROLL-1'),
  pg_temp.vec(2), 'auraface', 'v2', 0.8);
reset role;
select is(
  (select count(*)::text || ':' || max(model_version) from public.face_templates),
  '1:v2',
  're-enrolling replaces the template instead of adding a second row'
);

select tests.authenticate_as('enroll-staff@example.test');
select is(
  (select to_jsonb(s) ? 'embedding' from public.face_enrollment_status(
     (select id from public.clients where dni_number = 'ENROLL-1')) s),
  false,
  'face_enrollment_status never exposes the embedding'
);

select throws_ok(
  $$ select public.delete_face_template(
       (select id from public.clients where dni_number = 'ENROLL-1')) $$,
  'P0001', 'admin only',
  'a non-admin cannot delete a template'
);

-- ---- admin ----
reset role;
select tests.authenticate_as('enroll-admin@example.test');

select lives_ok(
  $$ select public.delete_face_template(
       (select id from public.clients where dni_number = 'ENROLL-1')) $$,
  'an admin can delete a template'
);

select is(
  (select has_template::text || ':' || has_consent::text from public.face_enrollment_status(
     (select id from public.clients where dni_number = 'ENROLL-1'))),
  'false:false',
  'after deletion there is no template and no live consent'
);

reset role;
select isnt(
  (select revoked_at from public.biometric_consents
   where client_id = (select id from public.clients where dni_number = 'ENROLL-1')),
  null,
  'deleting the template revokes the consent (revoked_at is set)'
);

select tests.authenticate_as('enroll-staff@example.test');
select throws_ok(
  $$ select public.enroll_face(
       (select id from public.clients where dni_number = 'ENROLL-1'),
       pg_temp.vec(1), 'auraface', 'v1', 0.9) $$,
  'P0001', 'consent required',
  'after revocation, enrolling needs a fresh consent'
);

select tests.authenticate_as('enroll-staff@example.test');
select public.grant_biometric_consent(
  (select id from public.clients where dni_number = 'ENROLL-1'), '2026-10-v1');
select throws_ok(
  $$ select public.enroll_face(
       (select id from public.clients where dni_number = 'ENROLL-1'),
       null::extensions.vector, 'auraface', 'v1', 0.9) $$,
  'P0001', 'invalid embedding',
  'a NULL embedding is rejected on enrollment'
);

-- ---- deactivated staff ----
reset role;
select tests.authenticate_as('enroll-off@example.test');
select throws_ok(
  $$ select public.grant_biometric_consent(
       (select id from public.clients where dni_number = 'ENROLL-1'), '2026-10-v1') $$,
  'P0001', 'staff only',
  'an inactive staff member cannot record consent'
);

-- ---- unknown client ----
reset role;
select tests.authenticate_as('enroll-staff@example.test');
select throws_ok(
  $$ select public.grant_biometric_consent(
       '00000000-0000-0000-0000-000000000000', '2026-10-v1') $$,
  'P0001', 'client not found',
  'consent for an unknown client is rejected'
);

select * from finish();
rollback;

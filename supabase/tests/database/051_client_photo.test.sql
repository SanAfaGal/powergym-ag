-- supabase/tests/database/051_client_photo.test.sql
--
-- Covers migration 0051: the photo a client registered with. The file lives in
-- the private storage bucket 'client-photos'; client_photos holds only its
-- path. A photo needs a live biometric consent, is replaced (the previous path
-- is returned so the app can delete that file) and is removed together with
-- the face template when the consent is revoked.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(14);

select is(
  (select public from storage.buckets where id = 'client-photos'),
  false,
  'the client-photos bucket exists and is private'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'client_photos_%'),
  3::bigint,
  'the bucket has read, upload and delete policies'
);

select tests.create_supabase_user('ph-staff@example.test', 'ph-staff@example.test');
select tests.create_supabase_user('ph-admin@example.test', 'ph-admin@example.test');
update public.profiles set role = 'admin'
  where id = tests.get_supabase_uid('ph-admin@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'PH-A', 'Paula', 'Foto'), ('CC', 'PH-B', 'Pedro', 'Antiguo');

select tests.authenticate_as('ph-staff@example.test');

select throws_ok(
  format($$ select public.set_client_photo(%L, %L) $$,
    (select id from public.clients where dni_number = 'PH-A'),
    (select id::text from public.clients where dni_number = 'PH-A') || '/a.jpg'),
  'P0001', 'consent required',
  'a photo cannot be stored without a live biometric consent'
);

select public.grant_biometric_consent(
  (select id from public.clients where dni_number = 'PH-A'), '2026-10-v2');
-- Pedro consented under the first text, which did not mention a photo
select public.grant_biometric_consent(
  (select id from public.clients where dni_number = 'PH-B'), '2026-10-v1');

select throws_ok(
  format($$ select public.set_client_photo(%L, 'otra-carpeta/a.jpg') $$,
    (select id from public.clients where dni_number = 'PH-A')),
  'P0001', 'invalid photo path',
  'the path must live in the client''s own folder'
);

select is(
  public.set_client_photo(
    (select id from public.clients where dni_number = 'PH-A'),
    (select id::text from public.clients where dni_number = 'PH-A') || '/a.jpg'),
  null,
  'the first photo has no previous path to clean up'
);

select is(
  public.set_client_photo(
    (select id from public.clients where dni_number = 'PH-A'),
    (select id::text from public.clients where dni_number = 'PH-A') || '/b.jpg'),
  (select id::text from public.clients where dni_number = 'PH-A') || '/a.jpg',
  'replacing the photo returns the previous path so the file can be deleted'
);

select is(
  (select path from public.client_photos
   where client_id = (select id from public.clients where dni_number = 'PH-A')),
  (select id::text from public.clients where dni_number = 'PH-A') || '/b.jpg',
  'staff can read the stored path, which is now the new one'
);

-- who may put files in the bucket: only a client's own folder, with a consent
-- that covers the photo
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('client-photos', %L) $$,
    (select id::text from public.clients where dni_number = 'PH-A') || '/up.jpg'),
  'staff can upload into the folder of a client with a valid consent'
);

select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('client-photos', %L) $$,
    (select id::text from public.clients where dni_number = 'PH-B') || '/up.jpg'),
  '42501', null,
  'no upload for a client whose consent predates the photo'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('client-photos', 'any-folder/up.jpg') $$,
  '42501', null,
  'no upload outside a client folder'
);

select throws_ok(
  format($$ select public.set_client_photo(%L, %L) $$,
    (select id from public.clients where dni_number = 'PH-B'),
    (select id::text from public.clients where dni_number = 'PH-B') || '/a.jpg'),
  'P0001', 'photo consent outdated',
  'a consent given before the photo was mentioned does not cover it'
);

-- (deleting is checked through the Storage API: Supabase refuses a direct
-- DELETE on storage tables)

select throws_ok(
  format($$ select public.delete_face_template(%L) $$,
    (select id from public.clients where dni_number = 'PH-A')),
  'P0001', 'admin only',
  'an employee cannot delete the biometric data'
);

reset role;
select tests.authenticate_as('ph-admin@example.test');

select public.delete_face_template(
  (select id from public.clients where dni_number = 'PH-A'));

select is(
  (select count(*) from public.client_photos
   where client_id = (select id from public.clients where dni_number = 'PH-A')),
  0::bigint,
  'deleting the face data also removes the photo record'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.set_client_photo('00000000-0000-0000-0000-000000000000', 'x/a.jpg') $$,
  '42501', null,
  'an unauthenticated caller cannot call set_client_photo'
);

select * from finish();
rollback;

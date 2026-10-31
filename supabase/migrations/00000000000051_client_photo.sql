-- supabase/migrations/00000000000051_client_photo.sql
--
-- The photo a client registered with, so reception can compare the person in
-- front of them with the person on file.
--
-- The image is a file in a PRIVATE storage bucket ('client-photos', JPEG only,
-- 512 KB max); the database keeps only its path in client_photos. Reading the
-- file is limited to active staff (storage policies below) and the app serves
-- it through short-lived signed URLs. A photo is biometric data, so it needs a
-- live consent and goes away with the face template when the consent is
-- revoked (delete_face_template, admin only). The kiosk never shows it.
--
-- Files live under '<client_id>/<file>.jpg'. Deleting a storage row from SQL
-- would not remove the object itself, so the app deletes the file through the
-- storage API; the functions here only return the paths it must clean up.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 524288, array['image/jpeg'])
on conflict (id) do nothing;

create policy client_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'client-photos' and public.is_active_staff());

create policy client_photos_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-photos' and public.is_active_staff());

create policy client_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-photos' and public.is_active_admin());

create table public.client_photos (
  client_id uuid primary key references public.clients (id) on delete cascade,
  path text not null,
  consent_id uuid not null references public.biometric_consents (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.client_photos enable row level security;
grant select on public.client_photos to authenticated;

create policy client_photos_select on public.client_photos
  for select to authenticated
  using (public.is_active_staff());

-- Records the photo just uploaded and returns the path of the one it replaces
-- (null if there was none), so the app can delete that file.
create function public.set_client_photo(p_client_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consent_id uuid;
  v_previous text;
begin
  if not public.is_active_staff() then
    raise exception 'staff only';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'client not found';
  end if;

  if p_path is null or p_path not like p_client_id::text || '/%' then
    raise exception 'invalid photo path';
  end if;

  select bc.id into v_consent_id
  from public.biometric_consents bc
  where bc.client_id = p_client_id and bc.revoked_at is null;

  if v_consent_id is null then
    raise exception 'consent required';
  end if;

  select cp.path into v_previous
  from public.client_photos cp
  where cp.client_id = p_client_id;

  insert into public.client_photos (client_id, path, consent_id, created_by)
  values (p_client_id, p_path, v_consent_id, auth.uid())
  on conflict (client_id) do update set
    path = excluded.path,
    consent_id = excluded.consent_id,
    created_by = excluded.created_by,
    created_at = now();

  return v_previous;
end;
$$;

revoke execute on function public.set_client_photo(uuid, text) from public;
grant execute on function public.set_client_photo(uuid, text) to authenticated;

-- As in 0043, plus: the photo record goes with the template and the consent.
create or replace function public.delete_face_template(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin only';
  end if;

  delete from public.client_photos cp where cp.client_id = p_client_id;
  delete from public.face_templates ft where ft.client_id = p_client_id;

  update public.biometric_consents bc
  set revoked_at = now(), revoked_by = auth.uid()
  where bc.client_id = p_client_id and bc.revoked_at is null;
end;
$$;

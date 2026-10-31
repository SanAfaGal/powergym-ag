-- supabase/migrations/00000000000052_client_photo_hardening.sql
--
-- Tightens the registration-photo rules from 0051.
--
-- 1. Uploads: a file may only go into a client's own folder ('<client_id>/...')
--    and only while that client has a live consent whose text covers the photo.
--    Before, any active staff could put any file anywhere in the bucket.
-- 2. Deletes: staff can delete a file that no client_photos row points to (a
--    replaced photo, or an upload whose record failed), so those do not pile up
--    when an employee, not an admin, re-enrolls someone. Admins can still
--    delete any file (revoking a consent). A current photo is never deletable
--    by an employee.
-- 3. Consent text: the first consent text (2026-10-v1) said no photograph would
--    be kept, so a photo needs a consent given under 2026-10-v2 or later. Text
--    versions are compared as strings; keep the yyyy-mm-vN form.

create function public.has_photo_consent(p_client_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.biometric_consents bc
    where bc.client_id::text = p_client_id
      and bc.revoked_at is null
      and bc.consent_text_version >= '2026-10-v2'
  );
$$;

revoke execute on function public.has_photo_consent(text) from public;
grant execute on function public.has_photo_consent(text) to authenticated;

drop policy client_photos_upload on storage.objects;
create policy client_photos_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-photos'
    and public.is_active_staff()
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_photo_consent((storage.foldername(name))[1])
  );

drop policy client_photos_delete on storage.objects;
create policy client_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-photos'
    and (
      public.is_active_admin()
      or (
        public.is_active_staff()
        and not exists (
          select 1 from public.client_photos cp where cp.path = name
        )
      )
    )
  );

create or replace function public.set_client_photo(p_client_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consent_id uuid;
  v_consent_version text;
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

  select bc.id, bc.consent_text_version into v_consent_id, v_consent_version
  from public.biometric_consents bc
  where bc.client_id = p_client_id and bc.revoked_at is null;

  if v_consent_id is null then
    raise exception 'consent required';
  end if;

  if v_consent_version < '2026-10-v2' then
    raise exception 'photo consent outdated';
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

-- supabase/migrations/00000000000043_face_enrollment_rpcs.sql
--
-- Consent, enrollment, deletion and status of facial templates. These are
-- the only way to touch biometric_consents / face_templates (migration 0041
-- grants staff nothing on them), so each is SECURITY DEFINER with its own
-- role guard. search_path includes `extensions` for the vector type.
--
-- Exception messages are an exact-match contract with the server actions
-- (src/modules/access-control/actions.ts): 'staff only', 'admin only',
-- 'client not found', 'consent required', 'invalid embedding'.

create function public.grant_biometric_consent(
  p_client_id uuid,
  p_consent_text_version text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'staff only';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'client not found';
  end if;

  select bc.id into v_id
  from public.biometric_consents bc
  where bc.client_id = p_client_id and bc.revoked_at is null;

  if v_id is null then
    insert into public.biometric_consents (client_id, consent_text_version, granted_by)
    values (p_client_id, p_consent_text_version, auth.uid())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create function public.enroll_face(
  p_client_id uuid,
  p_embedding extensions.vector,
  p_model_id text,
  p_model_version text,
  p_quality real
) returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_consent_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'staff only';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'client not found';
  end if;

  if vector_dims(p_embedding) <> 512 or vector_norm(p_embedding) = 0 then
    raise exception 'invalid embedding';
  end if;

  select bc.id into v_consent_id
  from public.biometric_consents bc
  where bc.client_id = p_client_id and bc.revoked_at is null;

  if v_consent_id is null then
    raise exception 'consent required';
  end if;

  insert into public.face_templates (
    client_id, embedding, model_id, model_version, quality_score, consent_id, created_by
  ) values (
    p_client_id, p_embedding, p_model_id, p_model_version, p_quality, v_consent_id, auth.uid()
  )
  on conflict (client_id) do update set
    embedding = excluded.embedding,
    model_id = excluded.model_id,
    model_version = excluded.model_version,
    quality_score = excluded.quality_score,
    consent_id = excluded.consent_id,
    created_by = excluded.created_by,
    created_at = now();
end;
$$;

-- Hard delete: the template is removed and the consent revoked together, so
-- re-enrolling afterwards needs a fresh consent.
create function public.delete_face_template(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin only';
  end if;

  delete from public.face_templates ft where ft.client_id = p_client_id;

  update public.biometric_consents bc
  set revoked_at = now(), revoked_by = auth.uid()
  where bc.client_id = p_client_id and bc.revoked_at is null;
end;
$$;

-- Never returns the embedding itself.
create function public.face_enrollment_status(p_client_id uuid)
returns table (
  has_template boolean,
  enrolled_at timestamptz,
  model_version text,
  has_consent boolean
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_active_staff() then
    raise exception 'staff only';
  end if;

  return query
  select
    ft.client_id is not null,
    ft.created_at,
    ft.model_version,
    exists (
      select 1 from public.biometric_consents bc
      where bc.client_id = p_client_id and bc.revoked_at is null
    )
  from (select 1) one
  left join public.face_templates ft on ft.client_id = p_client_id;
end;
$$;

revoke execute on function public.grant_biometric_consent(uuid, text) from public;
revoke execute on function public.enroll_face(uuid, extensions.vector, text, text, real) from public;
revoke execute on function public.delete_face_template(uuid) from public;
revoke execute on function public.face_enrollment_status(uuid) from public;
grant execute on function public.grant_biometric_consent(uuid, text) to authenticated;
grant execute on function public.enroll_face(uuid, extensions.vector, text, text, real) to authenticated;
grant execute on function public.delete_face_template(uuid) to authenticated;
grant execute on function public.face_enrollment_status(uuid) to authenticated;

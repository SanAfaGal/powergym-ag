"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  attemptSchema,
  enrollSchema,
  settingsSchema,
  type AttemptInput,
  type EnrollInput,
} from "./schema";
import { averageEmbeddings, toPgVector } from "./lib/embedding";
import { reasonMessage } from "./lib/decisionMessages";
import { rpcErrorMessage } from "./lib/errorMessages";
import { PHOTO_BUCKET, checkPhoto, photoStoragePath } from "./lib/photo";

export type AccessAttemptResult = {
  decision: "granted" | "denied";
  reasonCode: string;
  message: string;
  client: {
    id: string;
    fullName: string;
    alias: string | null;
    subscriptionStatus: string | null;
    endDate: string | null;
    planName: string | null;
    // distinct days this month with a granted entry (Bogota time)
    visitsThisMonth: number | null;
    // the previous granted entry, not the attempt that was just recorded
    lastVisit: string | null;
  } | null;
};

const INVALID_DATA_MESSAGE = "Revisá los datos ingresados";

export async function attemptAccess(
  values: AttemptInput
): Promise<{ error: string } | { success: true; result: AccessAttemptResult }> {
  const parsed = attemptSchema.safeParse(values);
  if (!parsed.success) {
    return { error: INVALID_DATA_MESSAGE };
  }

  // The user agent is read from the request, not from the client payload,
  // so an audited event can't be given a made-up one.
  const userAgent =
    (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("register_access_attempt", {
    p_embedding: toPgVector(parsed.data.embedding),
    p_liveness_passed: parsed.data.livenessPassed,
    p_device_label: parsed.data.deviceLabel,
    p_user_agent: userAgent,
  });

  if (error) {
    return {
      error: rpcErrorMessage(error.message, "No se pudo verificar el acceso"),
    };
  }

  // The similarity score is deliberately not part of the result: exposing it
  // would let a caller hill-climb an embedding. It lives in access_events.
  const row = (data ?? [])[0] as
    | {
        decision: "granted" | "denied";
        reason_code: string;
        client_id: string | null;
        full_name: string | null;
        alias: string | null;
        subscription_status: string | null;
        end_date: string | null;
        plan_name: string | null;
        visits_this_month: number | null;
        last_visit: string | null;
      }
    | undefined;

  if (!row) {
    return { error: "No se pudo verificar el acceso" };
  }

  return {
    success: true,
    result: {
      decision: row.decision,
      reasonCode: row.reason_code,
      message: reasonMessage(row.reason_code),
      client: row.client_id
        ? {
            id: row.client_id,
            fullName: row.full_name ?? "",
            alias: row.alias,
            subscriptionStatus: row.subscription_status,
            endDate: row.end_date,
            planName: row.plan_name,
            visitsThisMonth: row.visits_this_month,
            lastVisit: row.last_visit,
          }
        : null,
    },
  };
}

export async function grantConsent(
  clientId: string,
  consentTextVersion: string
): Promise<{ error: string } | { success: true; consentId: string }> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("grant_biometric_consent", {
    p_client_id: clientId,
    p_consent_text_version: consentTextVersion,
  });

  if (error || typeof data !== "string") {
    return {
      error: rpcErrorMessage(
        error?.message ?? "",
        "No se pudo registrar el consentimiento"
      ),
    };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true, consentId: data };
}

export async function enrollFace(
  values: EnrollInput
): Promise<{ error: string } | { success: true }> {
  const parsed = enrollSchema.safeParse(values);
  if (!parsed.success) {
    return { error: INVALID_DATA_MESSAGE };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("enroll_face", {
    p_client_id: parsed.data.clientId,
    p_embedding: toPgVector(averageEmbeddings(parsed.data.embeddings)),
    p_model_id: parsed.data.modelId,
    p_model_version: parsed.data.modelVersion,
    p_quality: parsed.data.quality,
  });

  if (error) {
    return {
      error: rpcErrorMessage(error.message, "No se pudo registrar el rostro"),
    };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { success: true };
}

// Deletes a photo file that no record points to. A failure is logged, not
// ignored, so a leftover file does not go unnoticed.
async function removePhotoFile(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  path: string
) {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("client photo cleanup failed", path, error.message);
}

// The registration photo, taken in the browser during enrollment. The file goes
// to the private bucket first and is then recorded (which also checks the
// consent); if recording fails the file is removed again, and the previous
// photo's file is removed once the new one is in place.
export async function uploadClientPhoto(
  clientId: string,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const file = formData.get("photo");
  if (!(file instanceof File) || !z.guid().safeParse(clientId).success) {
    return { error: INVALID_DATA_MESSAGE };
  }
  const problem = checkPhoto(file);
  if (problem) return { error: problem };

  const supabase = await createSupabaseClient();
  const path = photoStoragePath(clientId, crypto.randomUUID());

  const upload = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: "image/jpeg", upsert: false });
  if (upload.error) return { error: "No se pudo guardar la foto" };

  const { data, error } = await supabase.rpc("set_client_photo", {
    p_client_id: clientId,
    p_path: path,
  });
  if (error) {
    // the file is unreferenced, which staff are allowed to delete (see 0052)
    await removePhotoFile(supabase, path);
    return { error: rpcErrorMessage(error.message, "No se pudo guardar la foto") };
  }

  // the old file is unreferenced now (only the new path is recorded)
  if (typeof data === "string") await removePhotoFile(supabase, data);

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function deleteFaceTemplate(
  clientId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createSupabaseClient();

  // read the photo path before the RPC removes its record
  const { data: photo } = await supabase
    .from("client_photos")
    .select("path")
    .eq("client_id", clientId)
    .maybeSingle();

  const { error } = await supabase.rpc("delete_face_template", {
    p_client_id: clientId,
  });

  if (error) {
    return {
      error: rpcErrorMessage(error.message, "No se pudo eliminar el registro facial"),
    };
  }

  revalidatePath(`/clients/${clientId}`);

  if (photo?.path) {
    const removed = await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]);
    if (removed.error) {
      return {
        error:
          "Se eliminó el registro facial, pero no se pudo borrar la foto. Avisá al administrador.",
      };
    }
  }
  return { success: true };
}

export async function updateAccessSettings(
  matchThreshold: number,
  livenessRequired: boolean,
  livenessChallenges: string[],
  readmitCooldownMinutes: number
): Promise<{ error: string } | { success: true }> {
  const parsed = settingsSchema.safeParse({
    matchThreshold,
    livenessRequired,
    livenessChallenges,
    readmitCooldownMinutes,
  });
  if (!parsed.success) {
    const failedOn = (field: string) =>
      parsed.error.issues.some((i) => i.path.includes(field));
    return {
      error: rpcErrorMessage(
        failedOn("livenessChallenges")
          ? "invalid challenges"
          : failedOn("readmitCooldownMinutes")
            ? "invalid cooldown"
            : "invalid threshold",
        INVALID_DATA_MESSAGE
      ),
    };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("update_access_settings", {
    p_match_threshold: parsed.data.matchThreshold,
    p_liveness_required: parsed.data.livenessRequired,
    p_liveness_challenges: parsed.data.livenessChallenges,
    p_readmit_cooldown_minutes: parsed.data.readmitCooldownMinutes,
  });

  if (error) {
    return {
      error: rpcErrorMessage(error.message, "No se pudo guardar la configuración"),
    };
  }

  revalidatePath("/access");
  revalidatePath("/access/settings");
  return { success: true };
}

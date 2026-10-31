import { createClient } from "@/lib/supabase/server";

export type EnrollmentStatus = {
  hasTemplate: boolean;
  enrolledAt: string | null;
  modelVersion: string | null;
  hasConsent: boolean;
};

export type AccessSettings = {
  matchThreshold: number;
  livenessRequired: boolean;
};

export type AccessEvent = {
  id: string;
  occurredAt: string;
  clientId: string | null;
  clientName: string | null;
  decision: "granted" | "denied";
  reasonCode: string;
  matchScore: number | null;
  deviceLabel: string | null;
};

// Goes through face_enrollment_status (migration 0043): face_templates is not
// readable by staff, and the RPC never returns the embedding.
export async function getEnrollmentStatus(
  clientId: string
): Promise<EnrollmentStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("face_enrollment_status", {
    p_client_id: clientId,
  });

  if (error) throw error;

  const row = (data ?? [])[0] as
    | {
        has_template: boolean;
        enrolled_at: string | null;
        model_version: string | null;
        has_consent: boolean;
      }
    | undefined;

  return {
    hasTemplate: row?.has_template ?? false,
    enrolledAt: row?.enrolled_at ?? null,
    modelVersion: row?.model_version ?? null,
    hasConsent: row?.has_consent ?? false,
  };
}

export async function getAccessSettings(): Promise<AccessSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("access_settings")
    .select("match_threshold, liveness_required")
    .single();

  if (error) throw error;

  return {
    matchThreshold: data.match_threshold,
    livenessRequired: data.liveness_required,
  };
}

export async function listAccessEvents(opts: {
  limit: number;
  clientId?: string;
}): Promise<AccessEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("access_events")
    .select(
      "id, occurred_at, client_id, decision, reason_code, match_score, device_label, clients(first_name, last_name)"
    )
    .order("occurred_at", { ascending: false })
    .limit(opts.limit);

  if (opts.clientId) query = query.eq("client_id", opts.clientId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const client = row.clients as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    return {
      id: row.id,
      occurredAt: row.occurred_at,
      clientId: row.client_id,
      clientName: client ? `${client.first_name} ${client.last_name}` : null,
      decision: row.decision as "granted" | "denied",
      reasonCode: row.reason_code,
      matchScore: row.match_score,
      deviceLabel: row.device_label,
    };
  });
}

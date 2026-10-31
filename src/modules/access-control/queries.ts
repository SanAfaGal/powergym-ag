import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/date/bogota";
import { summarizeAttendance, type AttendanceSummary } from "./lib/attendance";
import { bogotaRange } from "./lib/dateRange";
import type { LivenessChallenge } from "./lib/liveness";

export type EnrollmentStatus = {
  hasTemplate: boolean;
  enrolledAt: string | null;
  modelVersion: string | null;
  hasConsent: boolean;
};

export type AccessSettings = {
  matchThreshold: number;
  livenessRequired: boolean;
  livenessChallenges: LivenessChallenge[];
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
    .select("match_threshold, liveness_required, liveness_challenges")
    .single();

  if (error) throw error;

  return {
    matchThreshold: data.match_threshold,
    livenessRequired: data.liveness_required,
    livenessChallenges: data.liveness_challenges as LivenessChallenge[],
  };
}

export type AccessEventFilters = {
  result?: "granted" | "denied";
  // part of the client's first or last name
  q?: string;
  // yyyy-mm-dd, Bogota days (inclusive)
  from?: string;
  to?: string;
};

type RawEvent = {
  id: string;
  occurred_at: string;
  client_id: string | null;
  decision: string;
  reason_code: string;
  device_label: string | null;
  clients: { first_name: string; last_name: string } | null;
};

const EVENT_COLUMNS =
  "id, occurred_at, client_id, decision, reason_code, device_label";

// Paged, filtered audit log. match_score is not readable by staff (migration
// 0046); admins get it through list_access_event_scores() for exactly the ids on
// the page, so `withScores` must only be true for them. `maxRows` caps what a
// non-admin can browse (the most recent N events).
export async function listAccessEvents(
  opts: AccessEventFilters & {
    page?: number;
    pageSize: number;
    maxRows?: number;
    clientId?: string;
    withScores?: boolean;
  }
): Promise<{ events: AccessEvent[]; total: number }> {
  const supabase = await createClient();
  const { fromIso, toExclusiveIso } = bogotaRange(opts.from, opts.to);
  // PostgREST's or() syntax breaks on these characters
  const q = opts.q?.replace(/[,()%*\\]/g, " ").trim();

  // !inner turns the embed into an inner join, so a name search only returns
  // events of identified clients.
  const columns = `${EVENT_COLUMNS}, clients${q ? "!inner" : ""}(first_name, last_name)`;
  let query = supabase
    .from("access_events")
    .select(columns, { count: "exact" })
    .order("occurred_at", { ascending: false });

  if (opts.result) query = query.eq("decision", opts.result);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (fromIso) query = query.gte("occurred_at", fromIso);
  if (toExclusiveIso) query = query.lt("occurred_at", toExclusiveIso);
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, {
      referencedTable: "clients",
    });
  }

  const page = Math.max(1, opts.page ?? 1);
  const rangeStart = (page - 1) * opts.pageSize;
  let rangeEnd = rangeStart + opts.pageSize - 1;
  if (opts.maxRows !== undefined) rangeEnd = Math.min(rangeEnd, opts.maxRows - 1);
  // past the cap (or an empty page): nothing to fetch
  if (rangeEnd < rangeStart) return { events: [], total: 0 };

  const { data, error, count } = await query.range(rangeStart, rangeEnd);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawEvent[];

  const scores = new Map<string, number | null>();
  if (opts.withScores && rows.length > 0) {
    const { data: scored, error: scoreError } = await supabase.rpc(
      "list_access_event_scores",
      { p_ids: rows.map((r) => r.id) }
    );
    if (scoreError) throw scoreError;
    for (const row of (scored ?? []) as { id: string; match_score: number | null }[]) {
      scores.set(row.id, row.match_score);
    }
  }

  const total = Math.min(count ?? rows.length, opts.maxRows ?? Infinity);
  return {
    total,
    events: rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      clientId: row.client_id,
      clientName: row.clients
        ? `${row.clients.first_name} ${row.clients.last_name}`
        : null,
      decision: row.decision as "granted" | "denied",
      reasonCode: row.reason_code,
      matchScore: scores.get(row.id) ?? null,
      deviceLabel: row.device_label,
    })),
  };
}

// Attendance comes from the granted entries still retained (12 months).
export async function getClientAttendance(
  clientId: string
): Promise<AttendanceSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("access_events")
    .select("occurred_at")
    .eq("client_id", clientId)
    .eq("decision", "granted")
    .order("occurred_at", { ascending: false })
    .limit(5000);

  if (error) throw error;
  return summarizeAttendance(
    (data ?? []).map((row) => row.occurred_at as string),
    bogotaToday()
  );
}

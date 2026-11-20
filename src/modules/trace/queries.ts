import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OriginSource = "whatsapp" | "panel" | "sistema";

// Cómo y cuándo se creó algo: viene de la tabla events (migración 0063).
export type Origin = {
  source: OriginSource;
  reportedBy: string | null;
  message: string | null;
  at: string;
};

export type ClientEdit = {
  at: string;
  by: string | null;
  source: OriginSource;
  changes: { field: string; from: unknown; to: unknown }[];
};

// Un cambio en una membresía: estado, inicio o fin, de antes a después.
export type SubscriptionChange = {
  at: string;
  by: string | null;
  source: OriginSource;
  changes: { field: string; from: unknown; to: unknown }[];
};

export type ClientTrace = {
  created: Origin | null; // null = el cliente es anterior al seguimiento
  edits: ClientEdit[];
  subscriptions: Record<string, Origin>; // por id de suscripción
  subscriptionChanges: Record<string, SubscriptionChange[]>; // por id de suscripción, lo más reciente primero
};

type EventRow = {
  type: string;
  subscription_id: string | null;
  reported_by: string | null;
  original_message: string | null;
  source: OriginSource | null;
  data: { cambios?: Record<string, [unknown, unknown]> } | null;
  created_at: string;
};

export async function getClientTrace(clientId: string): Promise<ClientTrace> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "type, subscription_id, reported_by, original_message, source, data, created_at"
    )
    .eq("client_id", clientId)
    .in("type", [
      "CLIENT_CREATED",
      "CLIENT_UPDATED",
      "SUBSCRIPTION_CREATED",
      "SUBSCRIPTION_UPDATED",
    ])
    .order("created_at", { ascending: false });

  if (error) throw error;

  const trace: ClientTrace = {
    created: null,
    edits: [],
    subscriptions: {},
    subscriptionChanges: {},
  };
  for (const e of (data ?? []) as EventRow[]) {
    const source = e.source ?? "sistema";
    const origin: Origin = {
      source,
      reportedBy: e.reported_by,
      message: e.original_message,
      at: e.created_at,
    };
    if (e.type === "CLIENT_CREATED") {
      trace.created = origin;
    } else if (e.type === "SUBSCRIPTION_CREATED" && e.subscription_id) {
      trace.subscriptions[e.subscription_id] = origin;
    } else if (e.type === "SUBSCRIPTION_UPDATED" && e.subscription_id) {
      (trace.subscriptionChanges[e.subscription_id] ??= []).push({
        at: e.created_at,
        by: e.reported_by,
        source,
        changes: Object.entries(e.data?.cambios ?? {}).map(([field, v]) => ({
          field,
          from: v[0],
          to: v[1],
        })),
      });
    } else if (e.type === "CLIENT_UPDATED") {
      trace.edits.push({
        at: e.created_at,
        by: e.reported_by,
        source,
        changes: Object.entries(e.data?.cambios ?? {}).map(([field, v]) => ({
          field,
          from: v[0],
          to: v[1],
        })),
      });
    }
  }
  return trace;
}

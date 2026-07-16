import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/modules/subscriptions";

export type Client = {
  id: string;
  dni_type: string | null;
  dni_number: string | null;
  first_name: string;
  last_name: string;
  alias: string | null;
  email: string | null;
  phone: string | null;
  alternative_phone: string | null;
  birth_date: string | null;
  gender: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
};

export type ClientWithSubscription = Client & {
  subscription_id: string | null;
  subscription_status: SubscriptionStatus | null;
  plan_id: string | null;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  final_price: number | null;
  paid: number | null;
  remaining: number | null;
  days_remaining: number | null;
};

export type CatalogEntry = { code: string; name: string };
// days_remaining is the only column staff actually triage by (who's about
// to expire / who's overdue); ascending surfaces the most urgent first.
export type SortOption = "days_remaining_asc" | "days_remaining_desc";

const PAGE_SIZE = 20;

const SORT_CONFIG: Record<SortOption, { column: string; ascending: boolean }> = {
  days_remaining_asc: { column: "days_remaining", ascending: true },
  days_remaining_desc: { column: "days_remaining", ascending: false },
};

export async function listClients({
  q,
  status,
  subscriptionStatus,
  planId,
  hasBalance,
  sort = "days_remaining_asc",
  page = 1,
}: {
  q?: string;
  status?: "active" | "inactive" | "all";
  subscriptionStatus?: SubscriptionStatus | "none" | "all";
  planId?: string;
  hasBalance?: boolean;
  sort?: SortOption;
  page?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("client_subscription_overview")
    .select("*", { count: "exact" });

  if (q) {
    // search_text (generated column, see migration 0032) is already
    // lowercased and accent-stripped, so the query side is normalized the
    // same way -- otherwise "José" (stored unaccented as "jose") would
    // never match a literal "é" typed by the user.
    const normalized = q
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .toLowerCase()
      .replace(/,/g, "");
    query = query.ilike("search_text", `%${normalized}%`);
  }

  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  if (subscriptionStatus === "none") {
    query = query.is("subscription_id", null);
  } else if (subscriptionStatus && subscriptionStatus !== "all") {
    query = query.eq("subscription_status", subscriptionStatus);
  }

  if (planId) query = query.eq("plan_id", planId);
  if (hasBalance) query = query.gt("remaining", 0);

  const { column, ascending } = SORT_CONFIG[sort];
  query = query.order(column, { ascending, nullsFirst: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);

  if (error) throw error;

  return {
    clients: (data ?? []) as ClientWithSubscription[],
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Client;
}

// React's cache() (request-scoped, see src/lib/auth/session.ts) rather than
// next/cache's unstable_cache() -- these queries go through the per-request,
// cookie-scoped Supabase client (RLS requires the caller's JWT to read even
// staff-only catalogs), and unstable_cache forbids touching cookies() inside
// its cached function. cache() dedupes repeat calls within one request/render
// tree without hitting that restriction; it doesn't persist across requests.
export const listDocumentTypes = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as CatalogEntry[];
});

export const listGenderTypes = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gender_types")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as CatalogEntry[];
});

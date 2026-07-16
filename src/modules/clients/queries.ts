import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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

export type CatalogEntry = { code: string; name: string };

const PAGE_SIZE = 20;

export async function listClients({
  q,
  status,
  page = 1,
}: {
  q?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

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

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);

  if (error) throw error;

  return {
    clients: (data ?? []) as Client[],
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

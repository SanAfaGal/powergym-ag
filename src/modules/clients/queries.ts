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
    // commas would break the .or() filter's own syntax, so they're
    // stripped rather than escaped -- no client name/DNI/alias/email needs
    // one.
    const pattern = `%${q.replace(/,/g, "")}%`;
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},dni_number.ilike.${pattern},alias.ilike.${pattern},email.ilike.${pattern}`
    );
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

export async function listDocumentTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as CatalogEntry[];
}

export async function listGenderTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gender_types")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data as CatalogEntry[];
}

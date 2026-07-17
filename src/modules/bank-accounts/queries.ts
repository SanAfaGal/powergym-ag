import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CatalogEntry = { code: string; name: string };

export type BankAccount = {
  id: string;
  bank_code: string;
  account_type_code: string;
  account_number: string;
  account_holder_name: string;
  transfer_key: string | null;
  is_active: boolean;
  created_at: string;
};

// React's cache() rather than next/cache's unstable_cache() -- see the note
// on listDocumentTypes in src/modules/clients/queries.ts for why.
export const listBankAccounts = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BankAccount[];
});

export const listActiveBankAccounts = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BankAccount[];
});

// React's cache() rather than next/cache's unstable_cache() -- see the note
// on listDocumentTypes in src/modules/clients/queries.ts for why.
export const listBanks = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banks")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as CatalogEntry[];
});

export const listBankAccountTypes = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_account_types")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as CatalogEntry[];
});

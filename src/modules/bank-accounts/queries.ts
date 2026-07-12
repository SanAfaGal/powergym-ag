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

export async function listBankAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BankAccount[];
}

export async function listActiveBankAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BankAccount[];
}

export async function listBanks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banks")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as CatalogEntry[];
}

export async function listBankAccountTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_account_types")
    .select("code, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as CatalogEntry[];
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { bankAccountSchema, type BankAccountInput } from "./schema";

export async function createBankAccount(
  values: BankAccountInput
): Promise<{ error: string } | void> {
  const parsed = bankAccountSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("bank_accounts").insert({
    bank_code: parsed.data.bank_code,
    account_type_code: parsed.data.account_type_code,
    account_number: parsed.data.account_number,
    account_holder_name: parsed.data.account_holder_name,
    transfer_key: parsed.data.transfer_key || null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una cuenta con ese número para ese banco"
          : "No se pudo crear la cuenta",
    };
  }

  revalidatePath("/bank-accounts");
  redirect("/bank-accounts");
}

export async function updateBankAccount(
  id: string,
  values: BankAccountInput
): Promise<{ error: string } | { success: true }> {
  const parsed = bankAccountSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({
      bank_code: parsed.data.bank_code,
      account_type_code: parsed.data.account_type_code,
      account_number: parsed.data.account_number,
      account_holder_name: parsed.data.account_holder_name,
      transfer_key: parsed.data.transfer_key || null,
    })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una cuenta con ese número para ese banco"
          : "No se pudo guardar los cambios",
    };
  }

  revalidatePath("/bank-accounts");
  return { success: true };
}

export async function setBankAccountActive(id: string, active: boolean) {
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/bank-accounts");
}

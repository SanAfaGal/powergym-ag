"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { clientSchema, type ClientInput } from "./schema";

function toRow(values: ClientInput) {
  return {
    dni_type: values.dni_type || null,
    dni_number: values.dni_number || null,
    first_name: values.first_name,
    last_name: values.last_name,
    alias: values.alias || null,
    email: values.email || null,
    phone: values.phone || null,
    alternative_phone: values.alternative_phone || null,
    birth_date: values.birth_date || null,
    gender: values.gender || null,
    address: values.address || null,
  };
}

export async function createClient(
  values: ClientInput
): Promise<{ error: string } | void> {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert(toRow(parsed.data))
    .select("id")
    .single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un cliente con ese número de documento"
          : "No se pudo crear el cliente",
    };
  }

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClient(
  id: string,
  values: ClientInput
): Promise<{ error: string } | { success: true }> {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update(toRow(parsed.data))
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un cliente con ese número de documento"
          : "No se pudo guardar los cambios",
    };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true };
}

export async function setClientActive(id: string, active: boolean) {
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

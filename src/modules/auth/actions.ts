"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "./schema";

export async function login(
  values: LoginInput
): Promise<{ error: string } | void> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Correo o contraseña incorrectos" };
  }

  // Checked here, not left to src/middleware.ts alone: a redirect issued by
  // middleware in response to the RSC fetch that follows this action's own
  // redirect doesn't reliably carry query params through to the browser
  // (observed in Next 16 -- the `?error=inactive` annotation gets dropped
  // on that specific request shape, though a plain top-level navigation to
  // a protected route redirects correctly with params intact). Checking
  // is_active here sidesteps that path entirely for the login flow itself.
  // Middleware still re-checks on every request, covering a session that
  // was valid at login time but got deactivated afterward.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta fue desactivada. Contactá a un administrador." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

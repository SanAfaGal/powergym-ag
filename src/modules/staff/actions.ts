"use server";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { isActiveAdmin } from "@/lib/auth/roles";
import { createStaffSchema, type CreateStaffInput } from "./schema";

// Service-role client -- authenticates as the Supabase project itself and
// bypasses ALL Row Level Security. This is the ONLY place in the app that
// constructs one (grep SUPABASE_SERVICE_ROLE_KEY to confirm). It is:
//   - never exported (this whole file is "use server", so nothing in it is
//     importable by client code in the first place, but this function in
//     particular never leaves this module either),
//   - built fresh per call from a server-only env var (no NEXT_PUBLIC_
//     prefix, so Next.js never inlines it into a client bundle),
//   - only ever reached from createStaff, and only AFTER that caller has
//     already been confirmed to be an active admin via the normal
//     authenticated client below -- see the comment in createStaff.
function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("El cliente de administración de Supabase no está configurado");
  }

  return createSupabaseJsClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Exact text of the "would remove the last active admin" guard raised by
// set_staff_role/set_staff_active (migration 0021). Matched below so that
// specific, actionable message reaches the admin verbatim, while any other
// unexpected DB error (including the internal "only an admin can..." guard,
// which should be unreachable given the page-level isActiveAdmin() redirect
// in src/app/(dashboard)/staff/page.tsx) falls back to a generic message
// instead of leaking raw Postgres error text to the UI.
const LAST_ADMIN_ERROR_MESSAGE =
  "No puedes remover al último administrador activo";

export async function updateStaffRole(
  id: string,
  role: "admin" | "employee"
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseClient();

  // set_staff_role (migration 0010, guarded further in migration 0021) is
  // security definer and re-checks is_active_admin() + the last-active-admin
  // invariant internally -- no app-layer check needed here, same pattern as
  // every other RPC-backed action in this codebase.
  const { error } = await supabase.rpc("set_staff_role", {
    p_target: id,
    p_role: role,
  });

  if (error) {
    return {
      success: false,
      error:
        error.message === LAST_ADMIN_ERROR_MESSAGE
          ? error.message
          : "No se pudo cambiar el rol",
    };
  }

  revalidatePath("/staff");
  return { success: true };
}

export async function setStaffActive(
  id: string,
  active: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("set_staff_active", {
    p_target: id,
    p_active: active,
  });

  if (error) {
    return {
      success: false,
      error:
        error.message === LAST_ADMIN_ERROR_MESSAGE
          ? error.message
          : "No se pudo cambiar el estado del usuario",
    };
  }

  revalidatePath("/staff");
  return { success: true };
}

export async function createStaff(
  values: CreateStaffInput
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = createStaffSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Revisá los datos ingresados" };
  }

  // Defense in depth: confirm the CALLING user is an active admin via the
  // normal authenticated (RLS-respecting) client BEFORE ever constructing
  // the service-role client below. This action is the first and only place
  // in the app that reaches for SUPABASE_SERVICE_ROLE_KEY, which bypasses
  // RLS entirely -- we don't rely solely on "only admins would know this
  // Server Action exists."
  let callerIsAdmin: boolean;
  try {
    callerIsAdmin = await isActiveAdmin();
  } catch {
    return {
      success: false,
      error: "No se pudo verificar el usuario actual",
    };
  }
  if (!callerIsAdmin) {
    return {
      success: false,
      error: "No tenés permiso para crear usuarios de staff",
    };
  }

  const { email, full_name, role, temporary_password } = parsed.data;

  const serviceRoleClient = createServiceRoleClient();
  const { data: created, error: createError } =
    await serviceRoleClient.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      // Only full_name here -- NOT role. handle_new_user (migration 0011)
      // deliberately reads role from raw_app_meta_data (server-only), not
      // raw_user_meta_data (what this `user_metadata` param sets), to close
      // a privilege-escalation path. So the new profiles row always lands
      // with role = 'employee' regardless of what's passed here; the
      // requested role (if different) is reconciled below via the
      // existing admin-gated set_staff_role RPC, not by trying to smuggle
      // it in through metadata.
      user_metadata: { full_name },
    });

  if (createError || !created?.user) {
    return {
      success: false,
      error: createError?.message.includes("already been registered")
        ? "Ya existe un usuario con ese correo"
        : "No se pudo crear el usuario",
    };
  }

  if (role !== "employee") {
    const supabase = await createSupabaseClient();
    const { error: roleError } = await supabase.rpc("set_staff_role", {
      p_target: created.user.id,
      p_role: role,
    });
    if (roleError) {
      return {
        success: false,
        error:
          "El usuario se creó pero no se pudo asignar el rol. Cambialo manualmente desde la lista de staff.",
      };
    }
  }

  revalidatePath("/staff");
  return { success: true };
}

import { createClient } from "@/lib/supabase/server";

export async function isActiveAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_active_admin");
  if (error) throw error;
  return Boolean(data);
}

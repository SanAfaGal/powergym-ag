import { createClient } from "@/lib/supabase/server";

export type StaffRow = {
  id: string;
  full_name: string;
  role: "admin" | "employee";
  is_active: boolean;
  created_at: string;
};

export async function listStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();

  // profiles_select_all_admin (migration 0007) already lets an admin
  // caller SELECT every row -- no new policy or RPC needed here, unlike
  // the mutations in actions.ts.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

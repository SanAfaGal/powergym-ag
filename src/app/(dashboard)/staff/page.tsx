import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { isActiveAdmin } from "@/lib/auth/roles";
import { listStaff, StaffList, CreateStaffDialog } from "@/modules/staff";

export default async function StaffPage() {
  if (!(await isActiveAdmin())) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth on top of src/middleware.ts and the isActiveAdmin()
  // check above -- should be unreachable. currentUserId is threaded down to
  // StaffList so the row-level self-lockout guard in StaffActions can tell
  // "this row" from "my row" (see migration 0021 for the authoritative,
  // DB-level version of the same guard).
  if (!user) redirect("/login");

  const staff = await listStaff();

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Usuarios con acceso al panel administrativo."
        actions={<CreateStaffDialog />}
      />
      <Card className="gap-0 py-0">
        <div className="p-4 sm:p-6">
          <StaffList staff={staff} currentUserId={user.id} />
        </div>
      </Card>
    </div>
  );
}

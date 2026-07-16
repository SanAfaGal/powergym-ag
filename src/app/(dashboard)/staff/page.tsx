import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/session";
import { listStaff, StaffList, CreateStaffDialog } from "@/modules/staff";

export default async function StaffPage() {
  const auth = await getAuthContext();

  // Defense in depth on top of src/middleware.ts -- should be unreachable.
  // currentUserId is threaded down to StaffList so the row-level
  // self-lockout guard in StaffActions can tell "this row" from "my row"
  // (see migration 0021 for the authoritative, DB-level version of the
  // same guard).
  if (!auth || auth.profile.role !== "admin" || !auth.profile.is_active) {
    redirect("/dashboard");
  }

  const staff = await listStaff();

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Usuarios con acceso al panel administrativo."
        actions={<CreateStaffDialog />}
      />
      <StaffList staff={staff} currentUserId={auth.user.id} />
    </div>
  );
}

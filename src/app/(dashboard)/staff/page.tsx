import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { isActiveAdmin } from "@/lib/auth/roles";
import { listStaff, StaffList, CreateStaffDialog } from "@/modules/staff";

export default async function StaffPage() {
  if (!(await isActiveAdmin())) redirect("/dashboard");

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
          <StaffList staff={staff} />
        </div>
      </Card>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StaffRoleBadge } from "./StaffRoleBadge";
import { StaffActions } from "./StaffActions";
import type { StaffRow } from "../queries";

export function StaffCards({ staff }: { staff: StaffRow[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {staff.map((member) => (
        <Card key={member.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{member.full_name}</span>
            <StatusBadge isActive={member.is_active} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <StaffRoleBadge role={member.role} />
          </div>
          <div className="mt-2">
            <StaffActions staff={member} />
          </div>
        </Card>
      ))}
    </div>
  );
}

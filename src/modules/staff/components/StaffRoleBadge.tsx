import { Badge } from "@/components/ui/badge";
import type { StaffRow } from "../queries";

export function StaffRoleBadge({ role }: { role: StaffRow["role"] }) {
  return (
    <Badge
      className={
        role === "admin"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }
    >
      {role === "admin" ? "Administrador" : "Empleado"}
    </Badge>
  );
}

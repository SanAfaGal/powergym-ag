import { Badge } from "@/components/ui/badge";
import type { StaffRow } from "../queries";

export function StaffRoleBadge({ role }: { role: StaffRow["role"] }) {
  return (
    <Badge
      variant="outline"
      className={
        role === "admin"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-foreground"
      }
    >
      {role === "admin" ? "Administrador" : "Empleado"}
    </Badge>
  );
}

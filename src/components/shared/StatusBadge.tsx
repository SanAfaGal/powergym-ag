import { Badge } from "@/components/ui/badge";

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      className={
        isActive
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive"
      }
    >
      {isActive ? "Activo" : "Inactivo"}
    </Badge>
  );
}

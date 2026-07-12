import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus } from "../queries";

// Labels match subscription_statuses' seeded `name` column verbatim
// (migration 0012) -- kept as a literal map rather than fetched from the
// DB since the 5 values are fixed application states, same reasoning as
// duration_type_enum staying a real enum instead of becoming a catalog
// table.
const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Activa",
  expired: "Vencida",
  pending_payment: "Pendiente de pago",
  scheduled: "Programada",
  canceled: "Cancelada",
};

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: "border-success/30 bg-success/10 text-success",
  pending_payment: "border-warning/30 bg-warning/10 text-warning-foreground",
  scheduled: "border-warning/30 bg-warning/10 text-warning-foreground",
  expired: "text-muted-foreground",
  canceled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

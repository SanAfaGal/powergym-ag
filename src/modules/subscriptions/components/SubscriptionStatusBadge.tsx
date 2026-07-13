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
  active: "bg-success/10 text-success",
  pending_payment: "bg-warning/10 text-warning",
  scheduled: "bg-warning/10 text-warning",
  expired: "bg-muted text-muted-foreground",
  canceled: "bg-destructive/10 text-destructive",
};

export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  return (
    <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>
  );
}

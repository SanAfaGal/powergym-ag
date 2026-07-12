import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/modules/subscriptions";
import type { DashboardStats, SubscriptionStatus } from "../queries";

// Fixed display order for the 5 application-level subscription statuses --
// same set SubscriptionStatusBadge/SubscriptionFilters use elsewhere.
const STATUS_ORDER: SubscriptionStatus[] = [
  "active",
  "pending_payment",
  "scheduled",
  "expired",
  "canceled",
];

export function SubscriptionStatusBreakdown({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripciones por estado</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center justify-between">
              <SubscriptionStatusBadge status={status} />
              <span className="tabular-nums font-medium">
                {/* jsonb_object_agg omits statuses with no rows, so default to 0 */}
                {(stats.subscription_stats[status] ?? 0).toLocaleString(
                  "es-CO"
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

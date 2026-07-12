import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import type { GlobalSubscriptionRow } from "../queries";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

export function SubscriptionCards({
  subscriptions,
}: {
  subscriptions: GlobalSubscriptionRow[];
}) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {subscriptions.map((sub) => (
        <Card key={sub.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/clients/${sub.client_id}`}
              className="font-medium hover:underline"
            >
              {sub.client_name}
            </Link>
            <SubscriptionStatusBadge status={sub.status} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{sub.plan_name}</span>
            <span className="tabular-nums">
              {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
            </span>
            {sub.remaining > 0 && (
              <span className="tabular-nums">
                Saldo: ${sub.remaining.toLocaleString("es-CO")}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/modules/subscriptions";
import type { DebtorRow } from "../queries";

export function DebtorsCards({ debtors }: { debtors: DebtorRow[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {debtors.map((debtor) => (
        <Card
          key={debtor.subscription_id}
          className="gap-2 bg-secondary/40 px-4 py-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/clients/${debtor.client_id}`}
              className="font-medium hover:underline"
            >
              {debtor.client_name}
            </Link>
            <SubscriptionStatusBadge status={debtor.status} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{debtor.plan_name}</span>
            <span className="tabular-nums">
              Saldo: ${debtor.remaining.toLocaleString("es-CO")}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

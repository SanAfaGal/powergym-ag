import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DURATION_UNIT_LABELS, type Plan } from "../queries";

type PlanRow = Plan & { currentPrice: number | null };

export function PlanCards({ plans }: { plans: PlanRow[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {plans.map((plan) => (
        <Card key={plan.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/plans/${plan.id}`}
              className="font-medium hover:underline"
            >
              {plan.name}
            </Link>
            <StatusBadge isActive={plan.is_active} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>
              {plan.duration_count} {DURATION_UNIT_LABELS[plan.duration_unit]}
            </span>
            {plan.currentPrice != null && (
              <span className="tabular-nums">
                ${plan.currentPrice.toLocaleString("es-CO")} {plan.currency}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

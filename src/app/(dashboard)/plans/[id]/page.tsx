import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BackLink } from "@/components/shared/BackLink";
import {
  getPlan,
  getPriceHistory,
  currentPriceFor,
  isAdmin,
  DURATION_UNIT_LABELS,
  PriceHistory,
  PlanEditDialog,
  SchedulePriceDialog,
  DeactivatePlanDialog,
} from "@/modules/plans";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Kicked off together (not sequentially awaited) -- the 4 calls are
  // mutually independent. getPlan keeps its own try/catch for notFound()
  // semantics; the other three keep their current (uncaught) error
  // behavior, just running concurrently with it instead of after it.
  const planPromise = getPlan(id);
  const pricesPromise = getPriceHistory(id);
  const isAdminPromise = isAdmin();
  const currentPricePromise = currentPriceFor(id);

  let plan;
  try {
    plan = await planPromise;
  } catch {
    notFound();
  }

  const [prices, canManage, currentPrice] = await Promise.all([
    pricesPromise,
    isAdminPromise,
    currentPricePromise,
  ]);

  return (
    <div>
      <BackLink href="/plans" label="Planes" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {plan.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge isActive={plan.is_active} />
            <span className="text-sm text-muted-foreground">
              {plan.duration_count} {DURATION_UNIT_LABELS[plan.duration_unit]}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <PlanEditDialog plan={plan} />
            <SchedulePriceDialog planId={plan.id} currentPrice={currentPrice} />
            <DeactivatePlanDialog
              planId={plan.id}
              planName={plan.name}
              isActive={plan.is_active}
            />
          </div>
        )}
      </div>

      {plan.description && (
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          {plan.description}
        </p>
      )}

      <Card className="max-w-2xl gap-0 py-0">
        <div className="border-b border-border p-4 sm:p-6">
          <h2 className="text-sm font-semibold">Historial de precios</h2>
        </div>
        <div className="p-4 sm:p-6">
          <PriceHistory
            planId={plan.id}
            prices={prices}
            currency={plan.currency}
            canManage={canManage}
          />
        </div>
      </Card>
    </div>
  );
}

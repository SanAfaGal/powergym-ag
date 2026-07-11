import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Plan } from "../queries";
import { PlanTable } from "./PlanTable";
import { PlanCards } from "./PlanCards";

type PlanRow = Plan & { currentPrice: number | null };

export function PlanList({
  plans,
  canCreate,
}: {
  plans: PlanRow[];
  canCreate: boolean;
}) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">Todavía no hay planes registrados</p>
        {canCreate && (
          <Button
            render={<Link href="/plans/new" />}
            nativeButton={false}
            size="sm"
          >
            Crear el primer plan
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <PlanTable plans={plans} />
      <PlanCards plans={plans} />
    </>
  );
}

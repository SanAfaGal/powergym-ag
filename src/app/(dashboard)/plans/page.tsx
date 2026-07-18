import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkPendingIndicator } from "@/components/shared/LinkPendingIndicator";
import { listPlans, isAdmin, PlanList } from "@/modules/plans";

export default async function PlansPage() {
  const [plans, canCreate] = await Promise.all([listPlans(), isAdmin()]);

  return (
    <div>
      <PageHeader
        title="Planes"
        description="Los planes de membresía disponibles en el gimnasio."
        actions={
          canCreate ? (
            <Button render={<Link href="/plans/new" />} nativeButton={false}>
              Nuevo plan
              <LinkPendingIndicator className="ml-1.5" />
            </Button>
          ) : undefined
        }
      />

      <PlanList plans={plans} canCreate={canCreate} />
    </div>
  );
}

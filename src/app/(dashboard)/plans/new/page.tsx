import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanForm, createPlan, isAdmin } from "@/modules/plans";

export default async function NewPlanPage() {
  if (!(await isAdmin())) redirect("/plans");

  return (
    <div>
      <PageHeader title="Nuevo plan" description="Crear un plan de membresía" />
      <Card className="max-w-xl p-4 sm:p-6">
        <PlanForm onSubmit={createPlan} submitLabel="Crear plan" />
      </Card>
    </div>
  );
}

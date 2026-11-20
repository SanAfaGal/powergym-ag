import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardListSkeleton } from "@/modules/dashboard";
import { DebtorsList, getDebtors } from "@/modules/debtors";

async function DebtorsSection() {
  const debtors = await getDebtors();
  return <DebtorsList debtors={debtors} />;
}

export default function DebtorsPage() {
  return (
    <div>
      <PageHeader
        title="Deudores"
        description="Quién debe y cuánto: deudas sueltas y saldos de membresías, la más antigua primero."
      />
      <Suspense fallback={<CardListSkeleton title="Deudores" rows={6} />}>
        <DebtorsSection />
      </Suspense>
    </div>
  );
}

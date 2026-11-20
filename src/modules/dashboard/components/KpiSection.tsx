import { getDebtors } from "@/modules/debtors";
import { DashboardKpiRow } from "./DashboardKpiRow";
import { SubscriptionStatusBreakdown } from "./SubscriptionStatusBreakdown";
import type { DashboardStats } from "../queries";

export async function KpiSection({
  statsPromise,
}: {
  statsPromise: Promise<DashboardStats>;
}) {
  const [stats, debtors] = await Promise.all([statsPromise, getDebtors()]);
  // Deuda pendiente y deudas abiertas salen de la misma lista que la pantalla Deudores (deudas sueltas + saldo de membresías),
  // para que los números de Inicio y de esa pantalla siempre cuadren.
  return (
    <DashboardKpiRow
      stats={stats}
      debtTotal={debtors.reduce((sum, d) => sum + d.total, 0)}
      debtorCount={debtors.length}
    />
  );
}

export async function SubscriptionStatusSection({
  statsPromise,
}: {
  statsPromise: Promise<DashboardStats>;
}) {
  const stats = await statsPromise;
  return <SubscriptionStatusBreakdown stats={stats} />;
}

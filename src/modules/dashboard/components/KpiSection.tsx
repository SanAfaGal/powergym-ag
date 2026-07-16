import { DashboardKpiRow } from "./DashboardKpiRow";
import { SubscriptionStatusBreakdown } from "./SubscriptionStatusBreakdown";
import type { DashboardStats } from "../queries";

export async function KpiSection({
  statsPromise,
}: {
  statsPromise: Promise<DashboardStats>;
}) {
  const stats = await statsPromise;
  return <DashboardKpiRow stats={stats} />;
}

export async function SubscriptionStatusSection({
  statsPromise,
}: {
  statsPromise: Promise<DashboardStats>;
}) {
  const stats = await statsPromise;
  return <SubscriptionStatusBreakdown stats={stats} />;
}

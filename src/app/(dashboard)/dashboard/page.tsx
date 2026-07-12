import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { listPaymentTypes } from "@/modules/subscriptions";
import {
  getDashboardStats,
  listDebtors,
  listExpiringSoon,
  DashboardFilters,
  DashboardKpiRow,
  SubscriptionStatusBreakdown,
  RevenueByMethodBreakdown,
  DebtorsList,
  ExpiringSoonList,
} from "@/modules/dashboard";
import { bogotaToday } from "@/lib/date/bogota";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const today = bogotaToday();
  const start = params.start ?? `${today.slice(0, 7)}-01`;
  const end = params.end ?? today;

  // Debtors and expiring-soon are current-state lists (who owes money /
  // whose subscription is about to lapse right now), not historical
  // reporting, so they intentionally ignore the start/end range filter
  // that only applies to the KPI row and the revenue-by-method breakdown.
  const [stats, debtors, expiringSoon, paymentTypes] = await Promise.all([
    getDashboardStats(start, end),
    listDebtors(),
    listExpiringSoon(),
    listPaymentTypes(),
  ]);

  return (
    <div>
      <PageHeader
        title="Panel"
        description="Estadísticas del gimnasio y estado de clientes."
      />

      <div className="mb-6">
        <DashboardFilters start={start} end={end} />
      </div>

      <div className="flex flex-col gap-6">
        <DashboardKpiRow stats={stats} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SubscriptionStatusBreakdown stats={stats} />
          <RevenueByMethodBreakdown stats={stats} paymentTypes={paymentTypes} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clientes con saldo pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <DebtorsList debtors={debtors} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suscripciones por vencer (próximos 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpiringSoonList rows={expiringSoon} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentType } from "@/modules/subscriptions";
import type { DashboardStats } from "../queries";

export function RevenueByMethodBreakdown({
  stats,
  paymentTypes,
}: {
  stats: DashboardStats;
  paymentTypes: PaymentType[];
}) {
  const entries = Object.entries(stats.financial_stats.revenue_by_method);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por método de pago</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay ingresos registrados en este rango
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map(([code, amount]) => (
              <li key={code} className="flex items-center justify-between">
                <span className="text-sm">
                  {paymentTypes.find((pt) => pt.code === code)?.name ?? code}
                </span>
                <span className="tabular-nums font-medium">
                  ${amount.toLocaleString("es-CO")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

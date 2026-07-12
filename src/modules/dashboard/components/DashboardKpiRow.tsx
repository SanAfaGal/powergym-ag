import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "../queries";

function KpiTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl font-bold tabular-nums tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardKpiRow({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label="Clientes activos"
        value={stats.client_stats.total_active_clients.toLocaleString(
          "es-CO"
        )}
      />
      <KpiTile
        label="Clientes nuevos"
        value={stats.client_stats.new_clients_in_range.toLocaleString(
          "es-CO"
        )}
      />
      <KpiTile
        label="Ingresos en rango"
        value={`$${stats.financial_stats.revenue_in_range.toLocaleString(
          "es-CO"
        )}`}
      />
      <KpiTile
        label="Deuda pendiente"
        value={`$${stats.financial_stats.pending_debt.toLocaleString(
          "es-CO"
        )}`}
      />
    </div>
  );
}

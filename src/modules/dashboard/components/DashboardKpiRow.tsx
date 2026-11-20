import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "../queries";

function KpiTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const card = (
    <Card className={href ? "transition-colors group-hover:bg-muted/50" : undefined}>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl font-bold tabular-nums tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group">
      {card}
    </Link>
  ) : (
    card
  );
}

export function DashboardKpiRow({
  stats,
  debtTotal,
  debtorCount,
}: {
  stats: DashboardStats;
  debtTotal: number;
  debtorCount: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        value={`$${debtTotal.toLocaleString("es-CO")}`}
        href="/debtors"
      />
      <KpiTile
        label="Deudas abiertas"
        value={debtorCount.toLocaleString("es-CO")}
        href="/debtors"
      />
    </div>
  );
}

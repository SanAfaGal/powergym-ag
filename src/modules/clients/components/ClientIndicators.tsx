// src/modules/clients/components/ClientIndicators.tsx
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/modules/dashboard";

function IndicatorTile({ label, value }: { label: string; value: string }) {
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

export function ClientIndicators({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      <IndicatorTile
        label="Activas"
        value={(stats.subscription_stats.active ?? 0).toLocaleString("es-CO")}
      />
      <IndicatorTile
        label="Pendientes de pago"
        value={(stats.subscription_stats.pending_payment ?? 0).toLocaleString(
          "es-CO"
        )}
      />
      <IndicatorTile
        label="Vencidas"
        value={(stats.subscription_stats.expired ?? 0).toLocaleString("es-CO")}
      />
      <IndicatorTile
        label="Por vencer (7 días)"
        value={stats.alerts.expiring_within_7_days.toLocaleString("es-CO")}
      />
      <IndicatorTile
        label="Saldo pendiente"
        value={`$${stats.financial_stats.pending_debt.toLocaleString("es-CO")}`}
      />
    </div>
  );
}

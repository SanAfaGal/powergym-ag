// src/modules/clients/components/ClientIndicators.tsx
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/modules/dashboard";

function IndicatorCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold tabular-nums tracking-tight sm:text-xl">
        {value}
      </p>
    </div>
  );
}

// One card with an internal grid, not five separate cards -- five stacked
// full-width cards (each with its own border/shadow/padding) burned most of
// a mobile screen's height before the filters or client list were even
// visible.
export function ClientIndicators({ stats }: { stats: DashboardStats }) {
  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        <IndicatorCell
          label="Activas"
          value={(stats.subscription_stats.active ?? 0).toLocaleString("es-CO")}
        />
        <IndicatorCell
          label="Pendientes de pago"
          value={(stats.subscription_stats.pending_payment ?? 0).toLocaleString(
            "es-CO"
          )}
        />
        <IndicatorCell
          label="Vencidas"
          value={(stats.subscription_stats.expired ?? 0).toLocaleString(
            "es-CO"
          )}
        />
        <IndicatorCell
          label="Por vencer (7 días)"
          value={stats.alerts.expiring_within_7_days.toLocaleString("es-CO")}
        />
        <IndicatorCell
          label="Saldo pendiente"
          value={`$${stats.financial_stats.pending_debt.toLocaleString("es-CO")}`}
        />
      </CardContent>
    </Card>
  );
}

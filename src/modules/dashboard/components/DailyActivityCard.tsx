import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import type { DailyActivityPayment } from "../queries";
import { formatDailyActivityText, formatMoney } from "../lib/formatDailyActivityText";

export function DailyActivityCard({
  date,
  payments,
}: {
  date: string;
  payments: DailyActivityPayment[];
}) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const summaryText = formatDailyActivityText(date, payments);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Actividad diaria</CardTitle>
        <CopyTextButton text={summaryText} />
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin pagos este día
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Pagos ({payments.length})</h3>
              <span className="text-sm font-medium tabular-nums">
                {formatMoney(total)}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {payments.map((p) => (
                <li
                  key={p.payment_id}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {p.client_name}
                    <span className="text-muted-foreground"> — {p.plan_name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatMoney(p.amount)} ({p.payment_method_name})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

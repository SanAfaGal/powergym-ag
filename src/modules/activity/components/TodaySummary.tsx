import Link from "next/link";
import { ArrowRight, CircleHelp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getOpenDoubtsCount, getTodayActivity } from "../queries";
import { formatMoney } from "../lib/format";

// Resumen de una línea para Inicio: lo cobrado hoy y las dudas pendientes, cada uno enlazado a /today.
export async function TodaySummary({ date }: { date: string }) {
  const [activity, doubts] = await Promise.all([
    getTodayActivity(date),
    getOpenDoubtsCount(),
  ]);
  const total = activity.entries.reduce((sum, e) => sum + e.amount, 0);
  const n = activity.entries.length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Link href="/today" className="group">
        <Card className="flex-row items-center gap-3 px-4 py-3 transition-colors group-hover:bg-muted/50">
          <Wallet className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Cobrado hoy</p>
            <p className="text-lg font-semibold">{formatMoney(total)}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {n} {n === 1 ? "pago" : "pagos"}
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>
      <Link href="/today" className="group">
        <Card className="flex-row items-center gap-3 px-4 py-3 transition-colors group-hover:bg-muted/50">
          <CircleHelp className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Dudas abiertas</p>
            <p className="text-lg font-semibold">
              {doubts === 0 ? "Ninguna" : doubts}
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>
    </div>
  );
}

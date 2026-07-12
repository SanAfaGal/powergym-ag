import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { ExpiringRow } from "../queries";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

export function ExpiringSoonCards({ rows }: { rows: ExpiringRow[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <Card
          key={row.subscription_id}
          className="gap-2 bg-secondary/40 px-4 py-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/clients/${row.client_id}`}
              className="font-medium hover:underline"
            >
              {row.client_name}
            </Link>
            <span className="tabular-nums text-sm text-muted-foreground">
              {formatDate(row.end_date)}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{row.plan_name}</span>
            {row.remaining > 0 && (
              <span className="tabular-nums">
                Saldo: ${row.remaining.toLocaleString("es-CO")}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

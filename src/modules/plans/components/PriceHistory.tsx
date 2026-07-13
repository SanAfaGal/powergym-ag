import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlanPrice } from "../queries";
import { CancelScheduledPriceDialog } from "./CancelScheduledPriceDialog";
import { bogotaToday } from "@/lib/date/bogota";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

function priceStatusBadge(isCurrent: boolean, isFuture: boolean) {
  if (isCurrent) {
    return <Badge className="bg-success/10 text-success">Vigente</Badge>;
  }
  if (isFuture) {
    return <Badge className="bg-warning/10 text-warning">Programado</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground">Anterior</Badge>;
}

export function PriceHistory({
  planId,
  prices,
  currency,
  canManage,
}: {
  planId: string;
  prices: PlanPrice[];
  currency: string;
  canManage: boolean;
}) {
  const today = bogotaToday();

  // Mirror plan_price_at's own tiebreak (valid_from desc, created_at desc)
  // instead of a simpler "valid_until is null" check: a row can be open
  // (valid_until null) but scheduled for the future, and two rows can
  // share a valid_from/valid_until boundary on a same-day correction --
  // only one row is ever "the" current price, and this is how the DB
  // itself picks it.
  const currentId = prices
    .filter(
      (p) =>
        p.valid_from <= today && (p.valid_until === null || p.valid_until >= today)
    )
    .sort((a, b) =>
      a.valid_from !== b.valid_from
        ? b.valid_from.localeCompare(a.valid_from)
        : b.created_at.localeCompare(a.created_at)
    )[0]?.id;

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Precio</TableHead>
              <TableHead>Vigente desde</TableHead>
              <TableHead>Vigente hasta</TableHead>
              <TableHead>Estado</TableHead>
              {canManage && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((p) => {
              const isFuture = p.valid_from > today;
              const isCurrent = p.id === currentId;
              return (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums font-medium">
                    ${p.price.toLocaleString("es-CO")} {currency}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(p.valid_from)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {p.valid_until ? formatDate(p.valid_until) : "—"}
                  </TableCell>
                  <TableCell>{priceStatusBadge(isCurrent, isFuture)}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {isFuture && (
                        <CancelScheduledPriceDialog
                          planId={planId}
                          priceId={p.id}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {prices.map((p) => {
          const isFuture = p.valid_from > today;
          const isCurrent = p.id === currentId;
          return (
            <Card key={p.id} className="gap-2 bg-secondary/40 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-nums font-medium">
                  ${p.price.toLocaleString("es-CO")} {currency}
                </span>
                {priceStatusBadge(isCurrent, isFuture)}
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  Desde {formatDate(p.valid_from)}
                </span>
                <span className="tabular-nums">
                  Hasta {p.valid_until ? formatDate(p.valid_until) : "—"}
                </span>
              </div>
              {canManage && isFuture && (
                <div className="pt-1">
                  <CancelScheduledPriceDialog planId={planId} priceId={p.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

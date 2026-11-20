import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactLinks } from "@/modules/clients/components/ContactLinks";
import { formatMoney } from "@/modules/activity/lib/format";
import type { Debtor } from "../queries";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function DebtorsList({ debtors }: { debtors: Debtor[] }) {
  const total = debtors.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total que deben
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Personas con deuda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{debtors.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deudores</CardTitle>
        </CardHeader>
        <CardContent>
          {debtors.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nadie debe nada
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {debtors.map((d) => {
                const days = daysSince(d.since);
                return (
                  <li key={d.clientId} className="flex flex-col gap-1 py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <Link
                        href={`/clients/${d.clientId}`}
                        className="min-w-0 truncate font-medium hover:underline"
                      >
                        {d.name}
                      </Link>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(d.total)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {d.phone && <ContactLinks phone={d.phone} />}
                      <span>desde {formatDate(d.since)}</span>
                      {days >= 30 && (
                        <Badge variant="destructive">{days} días</Badge>
                      )}
                    </div>
                    <ul className="text-xs text-muted-foreground">
                      {d.lines.map((l, i) => (
                        <li key={i} className="flex justify-between gap-4">
                          <span className="truncate">{l.concept}</span>
                          <span className="tabular-nums">
                            {formatMoney(l.balance)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

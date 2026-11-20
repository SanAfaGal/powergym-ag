import Link from "next/link";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bogotaToday } from "@/lib/date/bogota";
import { listExpiringClients } from "@/modules/clients";
import { ContactLinks } from "@/modules/clients/components/ContactLinks";

function whenLabel(days: number): string {
  if (days <= 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

// Clientes con membresía activa que vence hoy o mañana: lo que hay que accionar ya.
// Se limita a dos días para que la lista no crezca; el resto se ve en Clientes con el filtro de vencimientos.
export async function ExpiringSection() {
  const today = bogotaToday();
  const tomorrow = format(addDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd");
  const clients = await listExpiringClients(today, tomorrow, { status: "active" });

  return (
    <Card id="vencen" className="scroll-mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Vencen hoy y mañana</CardTitle>
        <Badge variant={clients.length > 0 ? "secondary" : "outline"}>
          {clients.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nadie vence hoy ni mañana
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {clients.map((c) => {
              const days = differenceInCalendarDays(
                new Date(`${c.end_date.slice(0, 10)}T12:00:00`),
                new Date(`${today}T12:00:00`)
              );
              return (
                <li
                  key={c.client_id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${c.client_id}`}
                      className="font-medium hover:underline"
                    >
                      {c.client_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.plan_name ?? "Sin plan"} · vence{" "}
                      {formatDate(c.end_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {c.phone && <ContactLinks phone={c.phone} />}
                    <Badge variant={days <= 1 ? "destructive" : "outline"}>
                      {whenLabel(days)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

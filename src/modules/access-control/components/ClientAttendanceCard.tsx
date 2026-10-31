import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceSummary } from "../lib/attendance";

function formatLastVisit(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// A day counts once however many times the client came in. The numbers come
// from the entries still retained (12 months), so older visits are not here.
export function ClientAttendanceCard({ summary }: { summary: AttendanceSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asistencia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-6">
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {summary.daysThisMonth}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.daysThisMonth === 1 ? "día" : "días"} este mes
            </p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {summary.daysLast12Months}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.daysLast12Months === 1 ? "día" : "días"} en 12 meses
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.lastVisit
            ? `Última visita: ${formatLastVisit(summary.lastVisit)}`
            : "Todavía no registra ingresos."}
        </p>
      </CardContent>
    </Card>
  );
}

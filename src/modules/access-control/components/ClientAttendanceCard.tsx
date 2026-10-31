import { CalendarDaysIcon, DoorOpenIcon, FootprintsIcon } from "lucide-react";
import { lastDays, type AttendanceSummary } from "../lib/attendance";

export type RecentEntry = { id: string; occurredAt: string; deviceLabel: string | null };

const STRIP_DAYS = 30;

function formatLastVisit(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEntry(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// One cell per day for the last 30 days, filled when the client came in.
function ThirtyDayStrip({ days, today }: { days: Set<string>; today: string }) {
  return (
    <div
      role="img"
      aria-label={`Días con ingreso en los últimos ${STRIP_DAYS} días`}
      className="flex gap-1"
    >
      {lastDays(today, STRIP_DAYS).map((day) => {
        const came = days.has(day);
        return (
          <span
            key={day}
            title={`${formatDay(day)}${came ? ": ingresó" : ""}`}
            className={`h-10 min-w-0 flex-1 rounded-md ${
              came ? "bg-success" : "bg-muted"
            } ${day === today ? "ring-2 ring-foreground/30 ring-offset-1 ring-offset-card" : ""}`}
          />
        );
      })}
    </div>
  );
}

// A day counts once however many times the client came in. The numbers come
// from the entries still retained (12 months), so older visits are not here.
// `recent` is the latest entries, newest first; `today` is the Bogota date.
export function ClientAttendanceCard({
  summary,
  recent,
  today,
}: {
  summary: AttendanceSummary;
  recent: RecentEntry[];
  today: string;
}) {
  if (summary.daysLast12Months === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FootprintsIcon className="size-7" />
        </span>
        <p className="font-heading text-lg font-semibold">Todavía no ha ingresado</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sus ingresos aparecerán aquí cuando use el acceso facial en el
          gimnasio.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col gap-4">
        <section className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Este mes</p>
          <p className="mt-1 font-heading text-7xl font-bold leading-none tabular-nums">
            {summary.daysThisMonth}
          </p>
          <p className="mt-2 text-muted-foreground">
            {summary.daysThisMonth === 1 ? "día de asistencia" : "días de asistencia"}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <section className="rounded-lg border border-border bg-card p-5">
            <p className="font-heading text-3xl font-bold tabular-nums">
              {summary.daysLast12Months}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.daysLast12Months === 1 ? "día" : "días"} en 12 meses
            </p>
          </section>
          <section className="rounded-lg border border-border bg-card p-5">
            <CalendarDaysIcon className="size-5 text-muted-foreground" />
            <p className="mt-1 text-sm font-medium leading-snug first-letter:uppercase">
              {summary.lastVisit ? formatLastVisit(summary.lastVisit) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">última visita</p>
          </section>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-base font-semibold">
              Últimos {STRIP_DAYS} días
            </h2>
            <span className="text-xs text-muted-foreground">hoy a la derecha</span>
          </div>
          <ThirtyDayStrip days={new Set(summary.days)} today={today} />
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-base font-semibold">
            Últimos ingresos
          </h2>
          <ul className="divide-y divide-border">
            {recent.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <DoorOpenIcon className="size-4 shrink-0 text-success" />
                <span className="shrink-0 font-medium first-letter:uppercase">
                  {formatEntry(entry.occurredAt)}
                </span>
                {entry.deviceLabel && (
                  <span className="ml-auto min-w-0 truncate text-muted-foreground">
                    {entry.deviceLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

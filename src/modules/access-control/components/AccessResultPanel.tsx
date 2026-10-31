import {
  CalendarCheckIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  HistoryIcon,
  ScanFaceIcon,
} from "lucide-react";
import { bogotaToday } from "@/lib/date/bogota";
import { SubscriptionStatusBadge } from "@/modules/subscriptions/components/SubscriptionStatusBadge";
import type { SubscriptionStatus } from "@/modules/subscriptions";
import type { AccessAttemptResult } from "../actions";
import { describeAccessUntil } from "../lib/accessUntil";

function formatLastVisit(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const UNTIL_TONE = {
  ok: "text-foreground",
  last: "text-warning",
  expired: "text-destructive",
} as const;

// Fills the space it is given: a waiting state until a result arrives, then a
// large authorized/denied card the staff (and the client) can read from a
// distance. `expanded` is used while the camera is tucked away and the result
// has the whole screen.
export function AccessResultPanel({
  result,
  expanded = false,
}: {
  result: AccessAttemptResult | null;
  expanded?: boolean;
}) {
  if (!result) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <ScanFaceIcon className="size-16 text-muted-foreground/50" />
        <p className="text-xl font-semibold text-muted-foreground">
          Esperando a la siguiente persona
        </p>
        <p className="text-sm text-muted-foreground">
          El resultado del acceso aparece acá.
        </p>
      </div>
    );
  }

  const granted = result.decision === "granted";
  const { client } = result;
  const until = client?.endDate
    ? describeAccessUntil(client.endDate, bogotaToday())
    : null;
  const big = expanded;

  return (
    <div
      role="status"
      className={`flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl border-2 p-6 text-center duration-500 animate-in fade-in zoom-in-95 ${
        granted
          ? "border-success/50 bg-success/10 text-success"
          : "border-destructive/50 bg-destructive/10 text-destructive"
      }`}
    >
      {granted ? (
        <CircleCheckBigIcon className={`shrink-0 ${big ? "size-32" : "size-20"}`} />
      ) : (
        <CircleXIcon className={`shrink-0 ${big ? "size-32" : "size-20"}`} />
      )}
      <p
        className={`font-heading font-bold tracking-tight ${
          big ? "text-5xl" : "text-3xl"
        }`}
      >
        {granted ? "Acceso autorizado" : "Acceso denegado"}
      </p>
      {!granted && (
        <p className={`font-medium ${big ? "text-3xl" : "text-xl"}`}>
          {result.message}
        </p>
      )}

      {client ? (
        <div className="flex w-full max-w-xl flex-col items-center gap-3 text-foreground">
          <div className="space-y-1">
            <p className={`font-semibold ${big ? "text-4xl" : "text-3xl"}`}>
              {client.fullName}
            </p>
            {client.alias && (
              <p className="text-lg text-muted-foreground">{client.alias}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {client.subscriptionStatus && (
              <SubscriptionStatusBadge
                status={client.subscriptionStatus as SubscriptionStatus}
              />
            )}
            {client.planName && (
              <span className="rounded-full bg-muted px-3 py-0.5 text-sm font-medium">
                {client.planName}
              </span>
            )}
          </div>

          {until && (
            <div className="space-y-0.5">
              <p
                className={`font-semibold ${UNTIL_TONE[until.tone]} ${
                  big ? "text-2xl" : "text-lg"
                }`}
              >
                <CalendarCheckIcon className="mr-2 inline size-5 align-[-3px]" />
                {until.headline}
              </p>
              {until.detail && (
                <p className="text-base text-muted-foreground">{until.detail}</p>
              )}
            </div>
          )}

          {(client.visitsThisMonth != null || client.lastVisit) && (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              {client.visitsThisMonth != null && (
                <span className="flex items-center gap-1.5">
                  <HistoryIcon className="size-4" />
                  {client.visitsThisMonth}{" "}
                  {client.visitsThisMonth === 1 ? "asistencia" : "asistencias"} este
                  mes
                </span>
              )}
              {client.lastVisit && (
                <span>Última vez: {formatLastVisit(client.lastVisit)}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        !granted && (
          <p className={`text-foreground ${big ? "text-2xl" : "text-lg"}`}>
            Persona no identificada
          </p>
        )
      )}
    </div>
  );
}

import {
  CalendarCheckIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  ScanFaceIcon,
} from "lucide-react";
import { bogotaToday } from "@/lib/date/bogota";
import type { AccessAttemptResult } from "../actions";
import { describeAccessUntil } from "../lib/accessUntil";

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
        <div
          className={`flex w-full flex-col items-center gap-3 text-foreground ${
            big ? "max-w-4xl" : "max-w-xl"
          }`}
        >
          <p className={`font-semibold ${big ? "text-5xl" : "text-3xl"}`}>
            {client.fullName}
          </p>

          {until && (
            // One line: "Puede ingresar hasta el domingo, 29 de noviembre · Le
            // quedan 29 días". Only wraps (at the separator) on a narrow screen.
            <p
              className={`font-semibold ${UNTIL_TONE[until.tone]} ${
                big ? "text-2xl" : "text-lg"
              }`}
            >
              <span className="whitespace-nowrap">
                <CalendarCheckIcon className="mr-2 inline size-6 align-[-4px]" />
                {until.headline}
              </span>
              {until.detail && (
                <span className="whitespace-nowrap font-normal text-muted-foreground">
                  {" · "}
                  {until.detail}
                </span>
              )}
            </p>
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

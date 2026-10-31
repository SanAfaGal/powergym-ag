import {
  CalendarCheckIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  ScanFaceIcon,
  TriangleAlertIcon,
  UserRoundXIcon,
} from "lucide-react";
import { bogotaToday } from "@/lib/date/bogota";
import { describeAccessUntil } from "../lib/accessUntil";
import { firstName, type ResultView } from "../lib/kioskView";

const UNTIL_TONE = {
  ok: "text-foreground",
  last: "text-warning",
  expired: "text-destructive",
} as const;

// Fills the space it is given. Shows what the kiosk decided, in plain words and
// large type, with only what matters in the few seconds it is on screen.
// `expanded` is used while the camera is tucked away and the result has the
// whole stage.
export function AccessResultPanel({
  view,
  expanded = false,
}: {
  view: ResultView;
  expanded?: boolean;
}) {
  const big = expanded;
  const icon = big ? "size-32" : "size-20";
  const title = big ? "text-5xl" : "text-3xl";
  const sub = big ? "text-3xl" : "text-xl";

  if (view.kind === "idle") {
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

  const shell =
    "flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl border-2 p-6 text-center duration-500 animate-in fade-in zoom-in-95";

  if (view.kind === "not_recognized") {
    return (
      <div role="status" className={`${shell} border-warning/50 bg-warning/10 text-warning`}>
        <UserRoundXIcon className={`shrink-0 ${icon}`} />
        <p className={`font-heading font-bold tracking-tight ${title}`}>
          No pudimos identificarte
        </p>
        <p className={`text-foreground ${sub}`}>
          Ubícate de frente a la cámara y lo intentamos de nuevo.
        </p>
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div role="status" className={`${shell} border-destructive/50 bg-destructive/10 text-destructive`}>
        <TriangleAlertIcon className={`shrink-0 ${icon}`} />
        <p className={`font-heading font-bold tracking-tight ${title}`}>Algo salió mal</p>
        <p className={`text-foreground ${sub}`}>{view.message}</p>
        <p className="text-muted-foreground">Volvemos a intentarlo en unos segundos.</p>
      </div>
    );
  }

  const { result } = view;
  const granted = view.kind === "granted";
  const client = result.client;
  const until = client?.endDate
    ? describeAccessUntil(client.endDate, bogotaToday())
    : null;
  const name = client ? firstName(client.fullName) : "";

  return (
    <div
      role="status"
      className={`${shell} ${
        granted
          ? "border-success/50 bg-success/10 text-success"
          : "border-destructive/50 bg-destructive/10 text-destructive"
      }`}
    >
      {granted ? (
        <CircleCheckBigIcon className={`shrink-0 ${icon}`} />
      ) : (
        <CircleXIcon className={`shrink-0 ${icon}`} />
      )}

      {granted ? (
        <>
          <p className={`font-heading font-bold tracking-tight ${title}`}>
            {name ? `¡Bienvenido, ${name}!` : "¡Bienvenido!"}
          </p>
          <p className={`font-medium ${sub}`}>Acceso autorizado</p>
        </>
      ) : (
        <>
          <p className={`font-heading font-bold tracking-tight ${title}`}>
            Acceso denegado
          </p>
          <p className={`font-medium ${sub}`}>{result.message}</p>
          {name && (
            <p className={`text-foreground ${big ? "text-3xl" : "text-xl"}`}>{name}</p>
          )}
        </>
      )}

      {until && (
        <div
          className={`flex w-full flex-col items-center gap-3 text-foreground ${
            big ? "max-w-4xl" : "max-w-xl"
          }`}
        >
          {/* One line: "Puede ingresar hasta el domingo, 29 de noviembre · Le
              quedan 29 días". Only wraps (at the separator) on a narrow screen. */}
          <p
            className={`font-semibold ${UNTIL_TONE[until.tone]} ${
              big ? "text-2xl" : "text-lg"
            }`}
          >
            <span className="lg:whitespace-nowrap">
              <CalendarCheckIcon className="mr-2 inline size-6 align-[-4px]" />
              {until.headline}
            </span>
            {until.detail && (
              <span className="font-normal text-muted-foreground lg:whitespace-nowrap">
                {" · "}
                {until.detail}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

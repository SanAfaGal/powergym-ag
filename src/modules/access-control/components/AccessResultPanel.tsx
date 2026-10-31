import {
  CalendarCheckIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  CheckIcon,
  CircleIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UserRoundXIcon,
} from "lucide-react";
import { bogotaToday } from "@/lib/date/bogota";
import { describeAccessUntil } from "../lib/accessUntil";
import { firstName, type ResultView, type StageStatus } from "../lib/kioskView";

const STAGES = [
  "Captura realizada",
  "Generando tu huella facial en este dispositivo",
  "Verificando identidad y membresía",
] as const;

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground duration-300 animate-in zoom-in-50">
        <CheckIcon className="size-6" />
      </span>
    );
  }
  if (status === "active") {
    return <Loader2Icon className="size-10 shrink-0 animate-spin text-primary" />;
  }
  return <CircleIcon className="size-10 shrink-0 text-muted-foreground/30" />;
}

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

  // nothing to show: the camera has the whole stage
  if (view.kind === "idle") return null;

  if (view.kind === "processing") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full min-h-0 flex-col items-center justify-center gap-8 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-center duration-500 animate-in fade-in zoom-in-95"
      >
        <p className={`font-heading font-bold tracking-tight ${title}`}>
          Verificando tu acceso
        </p>
        <ol className="flex w-full max-w-xl flex-col gap-5 text-left">
          {STAGES.map((label, i) => {
            const status = view.stages[i] ?? "pending";
            return (
              // keyed by status: a stage that changes state re-mounts and
              // animates in (the check pops), so progress is visible
              <li
                key={`${label}-${status}`}
                style={{ animationDelay: `${i * 120}ms` }}
                className={`flex items-center gap-4 duration-500 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards ${
                  big ? "text-2xl" : "text-lg"
                } ${status === "pending" ? "text-muted-foreground" : "font-medium"}`}
              >
                <StageIcon status={status} />
                {label}
              </li>
            );
          })}
        </ol>
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

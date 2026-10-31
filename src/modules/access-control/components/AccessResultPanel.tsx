import {
  CalendarCheckIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  CheckIcon,
  CircleIcon,
  DumbbellIcon,
  Loader2Icon,
  ScanFaceIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  UserRoundXIcon,
} from "lucide-react";
import { bogotaToday } from "@/lib/date/bogota";
import { describeAccessUntil } from "../lib/accessUntil";
import type { ResultView, StageStatus } from "../lib/kioskView";

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
  const icon = big ? "size-12" : "size-9";

  // nothing to show: the camera has the whole stage
  if (view.kind === "idle") return null;

  if (view.kind === "processing") {
    return (
      <ResultCard
        tone="info"
        icon={<ScanFaceIcon className={icon} />}
        label="Verificando tu acceso"
        headline=""
        big={big}
      >
        <ol className="flex w-full flex-col gap-5 text-left">
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
      </ResultCard>
    );
  }

  if (view.kind === "not_recognized") {
    return (
      <ResultCard
        tone="warning"
        icon={<UserRoundXIcon className={icon} />}
        label="No identificado"
        headline="No pudimos identificarte"
        body="Ubícate de frente a la cámara y lo intentamos de nuevo."
        big={big}
      />
    );
  }

  if (view.kind === "error") {
    return (
      <ResultCard
        tone="error"
        icon={<TriangleAlertIcon className={icon} />}
        label="Algo salió mal"
        headline={view.message}
        body="Volvemos a intentarlo en unos segundos."
        big={big}
      />
    );
  }

  const { result } = view;
  const granted = view.kind === "granted";
  const client = result.client;
  const until = client?.endDate
    ? describeAccessUntil(client.endDate, bogotaToday())
    : null;
  const name = client?.fullName ?? "";

  // Just let in a moment ago: not a real denial, so no alarm color and no
  // membership details, only the name and one short line.
  if (result.reasonCode === "recently_admitted") {
    return (
      <ResultCard
        tone="warning"
        icon={<UserCheckIcon className={icon} />}
        label="Ya ingresaste"
        headline={name}
        body="Tu ingreso ya quedó registrado."
        big={big}
      />
    );
  }

  const visits = client?.visitsThisMonth ?? null;

  return (
    <ResultCard
      tone={granted ? "success" : "error"}
      icon={
        granted ? (
          <CircleCheckBigIcon className={icon} />
        ) : (
          <CircleXIcon className={icon} />
        )
      }
      label={granted ? "Acceso autorizado" : "Acceso denegado"}
      headline={name}
      body={granted ? undefined : result.message}
      big={big}
    >
      {(until || visits !== null) && (
        <div className="flex flex-col gap-5">
          {until && (
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarCheckIcon className="size-6" />
              </span>
              <div className="min-w-0">
                {/* Fewest words: while the membership is fine only the days
                    left show; the full date appears when it is the last day
                    or already expired, where it is the point. */}
                <p
                  className={`font-semibold ${UNTIL_TONE[until.tone]} ${
                    big ? "text-2xl" : "text-lg"
                  }`}
                >
                  {until.tone === "ok" && until.detail
                    ? until.detail
                    : until.headline}
                </p>
                {until.tone !== "ok" && until.detail && (
                  <p className={`text-muted-foreground ${big ? "text-xl" : "text-base"}`}>
                    {until.detail}
                  </p>
                )}
              </div>
            </div>
          )}
          {visits !== null && (
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <DumbbellIcon className="size-6" />
              </span>
              <p className={`font-semibold ${big ? "text-2xl" : "text-lg"}`}>
                {visits === 1
                  ? "1 asistencia este mes"
                  : `${visits} asistencias este mes`}
              </p>
            </div>
          )}
        </div>
      )}
    </ResultCard>
  );
}

const TONES = {
  info: "border-primary/40 bg-primary text-primary-foreground",
  success: "border-success/40 bg-success text-success-foreground",
  warning: "border-warning/40 bg-warning text-warning-foreground",
  error: "border-destructive/40 bg-destructive text-white",
} as const;

// One card for every outcome: a solid status band (what happened, readable
// from across the room), then the person / reason, then optional details.
// Capped in width so it stays a card instead of stretching over the stage.
function ResultCard({
  tone,
  icon,
  label,
  eyebrow,
  headline,
  body,
  big,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  label: string;
  eyebrow?: string;
  headline: string;
  body?: string;
  big: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto p-4">
      {/* No drop shadow: the stage clips overflow, so a shadow would show up as
          a cut-off dark edge. A solid border keeps the card clean. */}
      <div
        role="status"
        className="w-full max-w-3xl overflow-hidden rounded-lg border-2 bg-card duration-500 animate-in fade-in zoom-in-95"
      >
        <div className={`flex items-center gap-4 border-b px-8 py-5 ${TONES[tone]}`}>
          <span className="shrink-0">{icon}</span>
          <p
            className={`font-heading font-bold uppercase tracking-wide ${
              big ? "text-3xl" : "text-xl"
            }`}
          >
            {label}
          </p>
        </div>
        <div className="flex flex-col gap-6 px-8 py-8">
          <div className="flex flex-col gap-2">
            {eyebrow && (
              <p className={`text-muted-foreground ${big ? "text-2xl" : "text-lg"}`}>
                {eyebrow}
              </p>
            )}
            {headline && (
              <p
                className={`font-heading font-bold leading-tight tracking-tight ${
                  big ? "text-5xl" : "text-3xl"
                }`}
              >
                {headline}
              </p>
            )}
            {body && (
              <p className={`text-muted-foreground ${big ? "text-2xl" : "text-lg"}`}>
                {body}
              </p>
            )}
          </div>
          {children && (
            <div className={eyebrow || headline || body ? "border-t pt-6" : ""}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

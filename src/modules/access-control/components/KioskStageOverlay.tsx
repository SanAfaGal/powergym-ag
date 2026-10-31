import { CameraIcon, CheckIcon, CircleIcon, Loader2Icon } from "lucide-react";
import type { KioskState } from "../lib/kioskMachine";
import { stageStatuses, type StageStatus } from "../lib/kioskView";

const STAGES = [
  "Captura",
  "Huella facial en este dispositivo",
  "Identidad y membresía",
] as const;

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-success text-success-foreground">
        <CheckIcon className="size-4" />
      </span>
    );
  }
  if (status === "active") {
    return <Loader2Icon className="size-6 animate-spin text-primary" />;
  }
  return <CircleIcon className="size-6 text-muted-foreground/40" />;
}

// Sits over the camera while an attempt runs: a flash when the frame is
// captured, and the real stages of the attempt. Each stage is pending, in
// progress or finished -- never a made-up percentage.
export function KioskStageOverlay({ state }: { state: KioskState }) {
  const statuses = stageStatuses(state);
  if (!statuses) return null;

  return (
    <>
      {state.name === "CAPTURING" && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-white/90 duration-300 animate-out fade-out fill-mode-forwards" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <CameraIcon className="size-16 text-white drop-shadow" />
          </div>
        </>
      )}
      <ol
        aria-label="Etapas de la verificación"
        className="absolute inset-x-4 bottom-24 flex flex-col gap-2 rounded-xl bg-background/90 p-4 backdrop-blur-md md:inset-x-auto md:left-1/2 md:w-96 md:-translate-x-1/2"
      >
        {STAGES.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-3 text-base ${
              statuses[i] === "pending" ? "text-muted-foreground" : "font-medium"
            }`}
          >
            <StageIcon status={statuses[i]} />
            {label}
          </li>
        ))}
      </ol>
    </>
  );
}

import { LockIcon, LockOpenIcon } from "lucide-react";
import type { BarrierState } from "../lib/barrier/BarrierController";

// Simulated gate: the long striped arm lifts while the barrier is open.
// Purely visual in this first stage -- no hardware is driven.
//
// The arm keeps its full length and lifts straight up (it does not swing), and
// the illustration box is tall enough for it and clips anything else
// (overflow-hidden), so the raised arm can never cover the access result above.
export function BarrierIndicator({ state }: { state: BarrierState }) {
  const open = state === "open";

  return (
    <div
      role="status"
      className={`flex shrink-0 flex-col gap-2 rounded-2xl border p-5 transition-colors duration-500 ${
        open ? "border-success/40 bg-success/10" : "border-border bg-card"
      }`}
    >
      <div className="relative h-32 w-full overflow-hidden">
        {/* fixed post (arm pivot) */}
        <div className="absolute bottom-0 left-2 h-12 w-5 rounded-md bg-foreground/80 shadow" />
        {/* receiver post */}
        <div className="absolute bottom-0 right-2 h-8 w-4 rounded-md bg-foreground/50" />
        {/* arm */}
        <div
          className={`absolute bottom-9 left-5 right-12 h-3.5 rounded-full shadow transition-transform duration-700 ease-out ${
            open
              ? "-translate-y-[4.5rem] bg-[repeating-linear-gradient(45deg,var(--color-success)_0_14px,white_14px_28px)]"
              : "translate-y-0 bg-[repeating-linear-gradient(45deg,var(--color-destructive)_0_14px,white_14px_28px)]"
          }`}
        />
      </div>
      <div
        className={`flex items-center justify-center gap-2 text-lg font-semibold ${
          open ? "text-success" : "text-destructive"
        }`}
      >
        {open ? <LockOpenIcon className="size-5" /> : <LockIcon className="size-5" />}
        {open ? "Barrera abierta" : "Barrera bloqueada"}
      </div>
    </div>
  );
}

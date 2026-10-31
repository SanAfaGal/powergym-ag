import { LockIcon, LockOpenIcon } from "lucide-react";
import type { BarrierState } from "../lib/barrier/BarrierController";

// Simulated gate: the striped arm swings up while the barrier is open. Purely
// visual in this first stage -- no hardware is driven.
export function BarrierIndicator({ state }: { state: BarrierState }) {
  const open = state === "open";

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-2xl border p-5 transition-colors duration-500 ${
        open ? "border-success/40 bg-success/10" : "border-border bg-card"
      }`}
    >
      <div className="relative h-24 w-full">
        {/* fixed post (arm pivot) */}
        <div className="absolute bottom-0 left-3 h-[4.5rem] w-5 rounded-md bg-foreground/80 shadow" />
        {/* receiver post */}
        <div className="absolute bottom-0 right-3 h-10 w-4 rounded-md bg-foreground/50" />
        {/* arm */}
        <div
          className={`absolute bottom-[3.75rem] left-6 right-9 h-3.5 origin-left rounded-full shadow transition-transform duration-700 ease-out ${
            open
              ? "-rotate-[72deg] bg-[repeating-linear-gradient(45deg,var(--color-success)_0_14px,white_14px_28px)]"
              : "rotate-0 bg-[repeating-linear-gradient(45deg,var(--color-destructive)_0_14px,white_14px_28px)]"
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

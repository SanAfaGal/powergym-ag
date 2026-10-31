import { LockIcon, LockOpenIcon } from "lucide-react";
import type { BarrierState } from "../lib/barrier/BarrierController";

// Simulated gate arm: swings up while the barrier is open. Purely visual in
// this first stage -- no hardware is driven.
export function BarrierIndicator({ state }: { state: BarrierState }) {
  const open = state === "open";
  return (
    <div className="flex items-center gap-3" role="status">
      <div className="relative h-8 w-28">
        <div className="absolute bottom-0 left-0 h-8 w-2 rounded-sm bg-muted-foreground/40" />
        <div
          className={`absolute bottom-3 left-1 h-2 w-24 origin-left rounded-full transition-transform duration-700 ${
            open ? "-rotate-[70deg] bg-success" : "rotate-0 bg-destructive"
          }`}
        />
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {open ? (
          <LockOpenIcon className="size-4 text-success" />
        ) : (
          <LockIcon className="size-4 text-destructive" />
        )}
        {open ? "Barrera abierta" : "Barrera bloqueada"}
      </div>
    </div>
  );
}

import type { BarrierController, BarrierState } from "./BarrierController.ts";

// First-stage adapter: no hardware, it only drives the on-screen indicator.
// Opens, then locks itself again after `openMs`; opening again while open
// restarts that timer.
export class SimulatedBarrier implements BarrierController {
  state: BarrierState = "locked";
  private readonly openMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<(state: BarrierState) => void>();

  constructor(options: { openMs?: number } = {}) {
    this.openMs = options.openMs ?? 3000;
  }

  async open(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.setState("open");
    this.timer = setTimeout(() => {
      this.timer = null;
      this.setState("locked");
    }, this.openMs);
  }

  subscribe(listener: (state: BarrierState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(next: BarrierState) {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}

export type BarrierState = "locked" | "open";

// Port for whatever physically (or virtually) opens the barrier. Access
// authorization never depends on a concrete device: a future adapter for a
// Hikvision/ZKTeco terminal, an ESP32 relay or a local service implements
// this same interface.
export interface BarrierController {
  readonly state: BarrierState;
  open(): Promise<void>;
  subscribe(listener: (state: BarrierState) => void): () => void;
}

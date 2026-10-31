import { CameraIcon } from "lucide-react";
import type { KioskState } from "../lib/kioskMachine";

// Sits over the camera at the moment of capture: a quick flash. The stages of
// the attempt are shown by the processing card once the camera tucks away.
export function KioskStageOverlay({ state }: { state: KioskState }) {
  if (state.name !== "CAPTURING") return null;
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-white/90 duration-300 animate-out fade-out fill-mode-forwards" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <CameraIcon className="size-16 text-white drop-shadow" />
      </div>
    </>
  );
}

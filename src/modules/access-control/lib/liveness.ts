export const TURN_YAW_DEG = 15;
export const FRONTAL_YAW_DEG = 5;

export type LivenessChallenge = "blink" | "turn_left" | "turn_right";
export type LivenessSignal = { eyesClosed: boolean; yaw: number };
export type LivenessState = "pending" | "passed" | "failed";

// Active challenge against photos held up to the camera. It does NOT stop a
// replayed video or a deepfake -- see the spec's risks section. Yaw is
// negative when the person turns to their left.
export function createLivenessSession(
  challenge: LivenessChallenge,
  timeoutMs: number,
): { update(signal: LivenessSignal, nowMs: number): LivenessState } {
  let state: LivenessState = "pending";
  let startMs: number | null = null;
  // blink: 0 = waiting for open eyes, 1 = saw them open, 2 = then saw closed
  let blinkPhase = 0;
  let sawFrontal = false;

  return {
    update(signal, nowMs) {
      if (state !== "pending") return state;
      if (startMs === null) startMs = nowMs;

      if (challenge === "blink") {
        if (blinkPhase === 0 && !signal.eyesClosed) blinkPhase = 1;
        else if (blinkPhase === 1 && signal.eyesClosed) blinkPhase = 2;
        else if (blinkPhase === 2 && !signal.eyesClosed) state = "passed";
      } else if (Math.abs(signal.yaw) < FRONTAL_YAW_DEG) {
        sawFrontal = true;
      } else if (sawFrontal) {
        // A turn only counts as a movement away from a frontal frame; a
        // first frame that is already turned (e.g. a photo held at an
        // angle) never passes.
        if (challenge === "turn_left" ? signal.yaw <= -TURN_YAW_DEG : signal.yaw >= TURN_YAW_DEG) {
          state = "passed";
        }
      }

      if (state === "pending" && nowMs - startMs > timeoutMs) state = "failed";
      return state;
    },
  };
}

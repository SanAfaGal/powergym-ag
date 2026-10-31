export const TURN_YAW_DEG = 15;
export const FRONTAL_YAW_DEG = 5;

export type LivenessChallenge =
  | "blink"
  | "open_mouth"
  | "smile"
  | "turn_any"
  | "turn_left"
  | "turn_right";

export type LivenessSignal = {
  eyesClosed: boolean;
  yaw: number;
  mouthOpen: boolean;
  smiling: boolean;
};
export type LivenessState = "pending" | "passed" | "failed";

// Neutral in EVERY facial attribute: eyes open, mouth closed, not smiling.
const isNeutral = (s: LivenessSignal) =>
  !s.eyesClosed && !s.mouthOpen && !s.smiling;

// Active challenge against photos held up to the camera. It does NOT stop a
// replayed video or a deepfake -- see the spec's risks section.
//
// Every challenge needs a NEUTRAL starting frame (eyes open, mouth closed, not
// smiling; head frontal for turns) before the gesture counts, so a photo that already
// shows the gesture never passes on its first frame. `turn_any` accepts a turn
// to either side and does not depend on the sign of yaw; `turn_left` /
// `turn_right` do (yaw is negative when the person turns to their left) and
// are not used by the kiosk until that sign is confirmed with a real face.
export function createLivenessSession(
  challenge: LivenessChallenge,
  timeoutMs: number,
): { update(signal: LivenessSignal, nowMs: number): LivenessState } {
  let state: LivenessState = "pending";
  let startMs: number | null = null;
  // blink: 0 = waiting for open eyes, 1 = saw them open, 2 = then saw closed
  let blinkPhase = 0;
  let sawNeutral = false;

  return {
    update(signal, nowMs) {
      if (state !== "pending") return state;
      if (startMs === null) startMs = nowMs;

      if (challenge === "blink") {
        if (blinkPhase === 0 && !signal.eyesClosed) blinkPhase = 1;
        else if (blinkPhase === 1 && signal.eyesClosed) blinkPhase = 2;
        else if (blinkPhase === 2 && !signal.eyesClosed) state = "passed";
      } else if (challenge === "open_mouth") {
        if (isNeutral(signal)) sawNeutral = true;
        else if (sawNeutral && signal.mouthOpen) state = "passed";
      } else if (challenge === "smile") {
        if (isNeutral(signal)) sawNeutral = true;
        else if (sawNeutral && signal.smiling) state = "passed";
      } else if (Math.abs(signal.yaw) < FRONTAL_YAW_DEG) {
        sawNeutral = true;
      } else if (sawNeutral) {
        const turned =
          challenge === "turn_left"
            ? signal.yaw <= -TURN_YAW_DEG
            : challenge === "turn_right"
              ? signal.yaw >= TURN_YAW_DEG
              : Math.abs(signal.yaw) >= TURN_YAW_DEG;
        if (turned) state = "passed";
      }

      if (state === "pending" && nowMs - startMs > timeoutMs) state = "failed";
      return state;
    },
  };
}

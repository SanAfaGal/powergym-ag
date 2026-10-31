import type { AccessAttemptResult } from "../actions";
import type { LivenessChallenge } from "./liveness.ts";

// How long to wait before trying again after a face was not recognized or a
// step failed. Short enough not to block the person, long enough not to hammer
// the recognition with the same frame.
export const RETRY_AFTER_MS = 3000;

// After a granted/denied result the same person must not be processed again,
// so the kiosk waits for them to leave. It must NEVER wait forever, though: if
// the next person steps in as the previous one leaves, or someone stands behind,
// no empty frame ever comes. Hence two ways out besides an empty frame: the
// camera telling it the person changed (PERSON_CHANGED), and this timeout.
export const EXIT_TIMEOUT_MS = 15_000;

export type FaceHint = "ok" | "too_far" | "not_frontal" | "too_dark" | "multiple_faces";

// One explicit state at a time: there are no independent booleans that could
// contradict each other. Data that only makes sense in a state lives in it.
export type KioskState =
  // camera off or not ready yet
  | { name: "IDLE" }
  // camera on, nobody (usable) in front of it. `requireExit`: a result was just
  // shown, so the person must leave first (no loop on the same face); then
  // `notBefore` is the time at which that wait expires by itself. Without
  // requireExit, `notBefore` is the retry pause: do not react to a face before it.
  | { name: "DETECTING"; requireExit: boolean; notBefore: number }
  | { name: "FACE_DETECTED"; hint: FaceHint }
  // not in the original flow: only when liveness is required
  | { name: "CHALLENGE"; challenge: LivenessChallenge }
  | { name: "CAPTURING"; livenessPassed: boolean }
  // embedding on the device
  | { name: "RECOGNIZING"; livenessPassed: boolean }
  // one server round trip: face comparison + membership rules
  | { name: "VALIDATING_MEMBERSHIP" }
  | { name: "ACCESS_GRANTED"; result: AccessAttemptResult }
  | { name: "ACCESS_DENIED"; result: AccessAttemptResult }
  | { name: "FACE_NOT_RECOGNIZED" }
  | { name: "ERROR"; message: string; recoverable: boolean };

export type KioskEvent =
  | { type: "CAMERA_READY" }
  | { type: "CAMERA_STOPPED" }
  // one detection frame, already reduced to what the machine needs
  | { type: "FRAME"; faceCount: number; hint: FaceHint | "no_face"; now: number }
  // the face has been usable for several consecutive frames; `challenge` is
  // the liveness challenge to ask for, or null when liveness is off
  | { type: "STABLE"; challenge: LivenessChallenge | null }
  | { type: "CHALLENGE_DONE"; passed: boolean }
  | { type: "CHALLENGE_ABORTED" }
  // the camera saw the previous person leave, or a different face appear
  | { type: "PERSON_CHANGED" }
  | { type: "CAPTURED" }
  | { type: "EMBEDDED" }
  | { type: "RESULT"; result: AccessAttemptResult }
  | { type: "FAILED"; message: string; recoverable?: boolean }
  // the result/error has been on screen long enough
  | { type: "DISPLAY_DONE"; now: number };

export const initialKioskState: KioskState = { name: "IDLE" };

const detecting = (requireExit: boolean, notBefore: number): KioskState => ({
  name: "DETECTING",
  requireExit,
  notBefore,
});

// Pure: same input, same output. Events that do not apply to the current state
// return the SAME state object, so late frames or duplicate events can never
// push the flow somewhere contradictory.
export function kioskReducer(state: KioskState, event: KioskEvent): KioskState {
  if (event.type === "CAMERA_STOPPED") {
    return state.name === "IDLE" ? state : initialKioskState;
  }

  switch (state.name) {
    case "IDLE":
      if (event.type === "CAMERA_READY") return detecting(false, 0);
      if (event.type === "FAILED") {
        return {
          name: "ERROR",
          message: event.message,
          recoverable: event.recoverable ?? true,
        };
      }
      return state;

    case "DETECTING": {
      if (event.type === "PERSON_CHANGED") {
        return state.requireExit ? detecting(false, 0) : state;
      }
      if (event.type !== "FRAME") return state;
      const present = event.faceCount > 0;
      if (state.requireExit) {
        // an empty frame, or the wait running out, ends it; either way this
        // frame is then judged like any other
        if (!present) return detecting(false, 0);
        if (event.now < state.notBefore) return state;
      } else if (!present || event.now < state.notBefore) {
        return state;
      }
      return {
        name: "FACE_DETECTED",
        hint: event.hint === "no_face" ? "too_far" : event.hint,
      };
    }

    case "FACE_DETECTED":
      if (event.type === "FRAME") {
        if (event.faceCount === 0) return detecting(false, 0);
        const hint = event.hint === "no_face" ? "too_far" : event.hint;
        return hint === state.hint ? state : { name: "FACE_DETECTED", hint };
      }
      if (event.type === "STABLE" && state.hint === "ok") {
        return event.challenge
          ? { name: "CHALLENGE", challenge: event.challenge }
          : { name: "CAPTURING", livenessPassed: false };
      }
      if (event.type === "FAILED") return failed(event);
      return state;

    case "CHALLENGE":
      if (event.type === "CHALLENGE_DONE") {
        return { name: "CAPTURING", livenessPassed: event.passed };
      }
      if (event.type === "CHALLENGE_ABORTED") return detecting(false, 0);
      if (event.type === "FAILED") return failed(event);
      return state;

    case "CAPTURING":
      if (event.type === "CAPTURED") {
        return { name: "RECOGNIZING", livenessPassed: state.livenessPassed };
      }
      if (event.type === "FAILED") return failed(event);
      return state;

    case "RECOGNIZING":
      if (event.type === "EMBEDDED") return { name: "VALIDATING_MEMBERSHIP" };
      if (event.type === "FAILED") return failed(event);
      return state;

    case "VALIDATING_MEMBERSHIP":
      if (event.type === "RESULT") {
        const { result } = event;
        if (result.reasonCode === "face_not_recognized") {
          return { name: "FACE_NOT_RECOGNIZED" };
        }
        return result.decision === "granted"
          ? { name: "ACCESS_GRANTED", result }
          : { name: "ACCESS_DENIED", result };
      }
      if (event.type === "FAILED") return failed(event);
      return state;

    case "ACCESS_GRANTED":
    case "ACCESS_DENIED":
      // the person must leave before the next attempt
      return event.type === "DISPLAY_DONE"
        ? detecting(true, event.now + EXIT_TIMEOUT_MS)
        : state;

    case "FACE_NOT_RECOGNIZED":
      return event.type === "DISPLAY_DONE"
        ? detecting(false, event.now + RETRY_AFTER_MS)
        : state;

    case "ERROR":
      if (event.type === "CAMERA_READY") return detecting(false, 0);
      if (event.type === "DISPLAY_DONE" && state.recoverable) {
        return detecting(false, event.now + RETRY_AFTER_MS);
      }
      return state;
  }
}

function failed(event: Extract<KioskEvent, { type: "FAILED" }>): KioskState {
  return {
    name: "ERROR",
    message: event.message,
    recoverable: event.recoverable ?? true,
  };
}

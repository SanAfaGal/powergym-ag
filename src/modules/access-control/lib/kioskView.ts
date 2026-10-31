import type { AccessAttemptResult } from "../actions";
import type { KioskState } from "./kioskMachine.ts";
import type { LivenessChallenge } from "./liveness.ts";
import { qualityMessage } from "./uiMessages.ts";

export type Tone = "info" | "warn" | "ok" | "error";
export type StageStatus = "pending" | "active" | "done";

const CHALLENGE_PROMPT: Record<LivenessChallenge, string> = {
  blink: "Parpadeá una vez para confirmar",
  open_mouth: "Abrí la boca para confirmar",
  smile: "Sonreí para confirmar",
  turn_any: "Girá la cabeza hacia un lado",
  turn_left: "Girá la cabeza hacia tu izquierda",
  turn_right: "Girá la cabeza hacia tu derecha",
};

// What the instruction banner over the camera says in each state. The result
// states return null: the result card shows them. While simply waiting for a
// person the tone is calm (info), never an error.
export function bannerFor(
  state: KioskState,
): { text: string; tone: Tone; pulse: boolean } | null {
  switch (state.name) {
    case "IDLE":
      return null;
    case "DETECTING":
      return { text: "Ubícate frente a la cámara", tone: "info", pulse: false };
    case "FACE_DETECTED":
      return state.hint === "ok"
        ? { text: "Rostro detectado", tone: "ok", pulse: false }
        : { text: qualityMessage(state.hint), tone: "warn", pulse: false };
    case "CHALLENGE":
      return { text: CHALLENGE_PROMPT[state.challenge], tone: "ok", pulse: true };
    case "CAPTURING":
      return { text: "Capturando...", tone: "info", pulse: false };
    case "RECOGNIZING":
      return { text: "Generando huella facial...", tone: "info", pulse: false };
    case "VALIDATING_MEMBERSHIP":
      return { text: "Verificando identidad y membresía...", tone: "info", pulse: false };
    case "ACCESS_GRANTED":
    case "ACCESS_DENIED":
    case "FACE_NOT_RECOGNIZED":
      return null;
    case "ERROR":
      return { text: state.message, tone: "error", pulse: false };
  }
}

// The three real stages of an attempt, as they actually happen: the frame is
// captured, the device computes the face embedding, and one server round trip
// compares it and checks the membership. No percentages: each stage is either
// not started, in progress, or finished.
export function stageStatuses(state: KioskState): StageStatus[] | null {
  switch (state.name) {
    case "CAPTURING":
      return ["active", "pending", "pending"];
    case "RECOGNIZING":
      return ["done", "active", "pending"];
    case "VALIDATING_MEMBERSHIP":
      return ["done", "done", "active"];
    default:
      return null;
  }
}

export type ResultView =
  | { kind: "idle" }
  | { kind: "granted"; result: AccessAttemptResult }
  | { kind: "denied"; result: AccessAttemptResult }
  // an attempt is running: the camera tucks away and the real stages show
  | { kind: "processing"; stages: StageStatus[] }
  | { kind: "not_recognized" }
  | { kind: "error"; message: string };

// What the right-hand card shows (and whether the camera tucks away: anything
// but "idle"). A camera error (not recoverable) is shown over the camera
// itself, so it is "idle" here.
export function resultViewFor(state: KioskState): ResultView {
  switch (state.name) {
    case "CAPTURING":
    case "RECOGNIZING":
    case "VALIDATING_MEMBERSHIP":
      return { kind: "processing", stages: stageStatuses(state) ?? [] };
    case "ACCESS_GRANTED":
      return { kind: "granted", result: state.result };
    case "ACCESS_DENIED":
      return { kind: "denied", result: state.result };
    case "FACE_NOT_RECOGNIZED":
      return { kind: "not_recognized" };
    case "ERROR":
      return state.recoverable
        ? { kind: "error", message: state.message }
        : { kind: "idle" };
    default:
      return { kind: "idle" };
  }
}

// The screen faces whoever is in front of it, so it greets by first name only.
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

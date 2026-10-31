import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RETRY_AFTER_MS,
  initialKioskState,
  kioskReducer,
  type KioskEvent,
  type KioskState,
} from "./kioskMachine.ts";

const result = (
  decision: "granted" | "denied",
  reasonCode: string,
  message = "m",
) => ({ decision, reasonCode, message, client: null });

const run = (events: KioskEvent[], from: KioskState = initialKioskState) =>
  events.reduce(kioskReducer, from);

const face = (hint: "ok" | "too_far" | "multiple_faces" = "ok", now = 0): KioskEvent => ({
  type: "FRAME",
  faceCount: hint === "multiple_faces" ? 2 : 1,
  hint,
  now,
});
const noFace = (now = 0): KioskEvent => ({
  type: "FRAME",
  faceCount: 0,
  hint: "no_face",
  now,
});

test("it starts idle and waits for a face once the camera is ready", () => {
  assert.equal(initialKioskState.name, "IDLE");
  assert.equal(run([{ type: "CAMERA_READY" }]).name, "DETECTING");
});

test("frames before the camera is ready are ignored", () => {
  assert.equal(run([face()]).name, "IDLE");
});

test("DETECTING shows no error while nobody is there", () => {
  const s = run([{ type: "CAMERA_READY" }, noFace(), noFace()]);
  assert.equal(s.name, "DETECTING");
});

test("a face moves DETECTING to FACE_DETECTED and the hint follows the quality", () => {
  let s = run([{ type: "CAMERA_READY" }, face("too_far")]);
  assert.deepEqual(s, { name: "FACE_DETECTED", hint: "too_far" });
  s = kioskReducer(s, face("ok"));
  assert.deepEqual(s, { name: "FACE_DETECTED", hint: "ok" });
  s = kioskReducer(s, noFace());
  assert.equal(s.name, "DETECTING");
});

test("several faces never get past FACE_DETECTED", () => {
  const s = run([
    { type: "CAMERA_READY" },
    face("multiple_faces"),
    { type: "STABLE", challenge: null },
  ]);
  assert.deepEqual(s, { name: "FACE_DETECTED", hint: "multiple_faces" });
});

test("STABLE only counts when the face quality is ok", () => {
  const s = run([
    { type: "CAMERA_READY" },
    face("too_far"),
    { type: "STABLE", challenge: null },
  ]);
  assert.equal(s.name, "FACE_DETECTED");
});

test("without liveness the stable face goes straight to CAPTURING", () => {
  const s = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: null },
  ]);
  assert.deepEqual(s, { name: "CAPTURING", livenessPassed: false });
});

test("the full happy path with a liveness challenge", () => {
  const states: string[] = [];
  let s: KioskState = initialKioskState;
  for (const e of [
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: "smile" },
    { type: "CHALLENGE_DONE", passed: true },
    { type: "CAPTURED" },
    { type: "EMBEDDED" },
    { type: "RESULT", result: result("granted", "ok") },
  ] as KioskEvent[]) {
    s = kioskReducer(s, e);
    states.push(s.name);
  }
  assert.deepEqual(states, [
    "DETECTING",
    "FACE_DETECTED",
    "CHALLENGE",
    "CAPTURING",
    "RECOGNIZING",
    "VALIDATING_MEMBERSHIP",
    "ACCESS_GRANTED",
  ]);
});

test("the liveness outcome is carried through capture and recognition", () => {
  const s = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: "blink" },
    { type: "CHALLENGE_DONE", passed: false },
    { type: "CAPTURED" },
  ]);
  assert.deepEqual(s, { name: "RECOGNIZING", livenessPassed: false });
});

test("a challenge can be aborted back to DETECTING", () => {
  const s = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: "blink" },
    { type: "CHALLENGE_ABORTED" },
  ]);
  assert.equal(s.name, "DETECTING");
});

test("the result decides between granted, denied and not recognized", () => {
  const upToValidating: KioskEvent[] = [
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: null },
    { type: "CAPTURED" },
    { type: "EMBEDDED" },
  ];
  assert.equal(
    run([...upToValidating, { type: "RESULT", result: result("granted", "ok") }]).name,
    "ACCESS_GRANTED",
  );
  assert.equal(
    run([
      ...upToValidating,
      { type: "RESULT", result: result("denied", "subscription_expired") },
    ]).name,
    "ACCESS_DENIED",
  );
  assert.equal(
    run([
      ...upToValidating,
      { type: "RESULT", result: result("denied", "face_not_recognized") },
    ]).name,
    "FACE_NOT_RECOGNIZED",
  );
  assert.equal(
    run([
      ...upToValidating,
      { type: "RESULT", result: result("denied", "liveness_failed") },
    ]).name,
    "ACCESS_DENIED",
  );
});

test("after a granted or denied result the person must leave before a new attempt", () => {
  let s = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: null },
    { type: "CAPTURED" },
    { type: "EMBEDDED" },
    { type: "RESULT", result: result("granted", "ok") },
    { type: "DISPLAY_DONE", now: 10_000 },
  ]);
  assert.deepEqual(s, { name: "DETECTING", requireExit: true, notBefore: 0 });

  // still standing there: nothing happens, however long it takes
  s = kioskReducer(s, face("ok", 60_000));
  assert.equal(s.name, "DETECTING");

  // leaves, then comes back
  s = kioskReducer(s, noFace(61_000));
  assert.deepEqual(s, { name: "DETECTING", requireExit: false, notBefore: 0 });
  s = kioskReducer(s, face("ok", 62_000));
  assert.equal(s.name, "FACE_DETECTED");
});

test("an unrecognized face is retried after a pause, without leaving", () => {
  let s = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: null },
    { type: "CAPTURED" },
    { type: "EMBEDDED" },
    { type: "RESULT", result: result("denied", "face_not_recognized") },
    { type: "DISPLAY_DONE", now: 1000 },
  ]);
  assert.deepEqual(s, {
    name: "DETECTING",
    requireExit: false,
    notBefore: 1000 + RETRY_AFTER_MS,
  });
  s = kioskReducer(s, face("ok", 1000 + RETRY_AFTER_MS - 1));
  assert.equal(s.name, "DETECTING");
  s = kioskReducer(s, face("ok", 1000 + RETRY_AFTER_MS));
  assert.equal(s.name, "FACE_DETECTED");
});

test("a processing failure becomes a recoverable ERROR that retries after a pause", () => {
  let s = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: null },
    { type: "CAPTURED" },
    { type: "FAILED", message: "No se pudo procesar el rostro" },
  ]);
  assert.deepEqual(s, {
    name: "ERROR",
    message: "No se pudo procesar el rostro",
    recoverable: true,
  });
  s = kioskReducer(s, { type: "DISPLAY_DONE", now: 5000 });
  assert.deepEqual(s, {
    name: "DETECTING",
    requireExit: false,
    notBefore: 5000 + RETRY_AFTER_MS,
  });
});

test("a camera failure is an ERROR that only a restarted camera clears", () => {
  let s = kioskReducer(initialKioskState, {
    type: "FAILED",
    message: "Permiso de cámara denegado",
    recoverable: false,
  });
  assert.equal(s.name, "ERROR");
  assert.equal(kioskReducer(s, { type: "DISPLAY_DONE", now: 1 }), s);
  s = kioskReducer(s, { type: "CAMERA_READY" });
  assert.equal(s.name, "DETECTING");
});

test("stopping the camera resets to IDLE from anywhere", () => {
  for (const events of [
    [{ type: "CAMERA_READY" }],
    [{ type: "CAMERA_READY" }, face()],
    [{ type: "CAMERA_READY" }, face(), { type: "STABLE", challenge: null }],
  ] as KioskEvent[][]) {
    assert.equal(run([...events, { type: "CAMERA_STOPPED" }]).name, "IDLE");
  }
});

test("events that do not apply to the current state are ignored (same object)", () => {
  const detecting = run([{ type: "CAMERA_READY" }]);
  assert.equal(kioskReducer(detecting, { type: "EMBEDDED" }), detecting);
  assert.equal(
    kioskReducer(detecting, { type: "RESULT", result: result("granted", "ok") }),
    detecting,
  );
  const capturing = run([
    { type: "CAMERA_READY" },
    face(),
    { type: "STABLE", challenge: null },
  ]);
  // frames keep arriving during processing and must not disturb it
  assert.equal(kioskReducer(capturing, face()), capturing);
  assert.equal(kioskReducer(capturing, noFace()), capturing);
});

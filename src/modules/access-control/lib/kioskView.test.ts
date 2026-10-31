import { test } from "node:test";
import assert from "node:assert/strict";
import { bannerFor, stageStatuses } from "./kioskView.ts";
import type { KioskState } from "./kioskMachine.ts";

const result = { decision: "granted" as const, reasonCode: "ok", message: "m", client: null };

test("waiting for a person shows a calm invitation, never an error", () => {
  const b = bannerFor({ name: "DETECTING", requireExit: false, notBefore: 0 });
  assert.deepEqual(b, { text: "Ubícate frente a la cámara", tone: "info", pulse: false });
});

test("a detected face says so, and a poor one gets a concrete instruction", () => {
  assert.equal(bannerFor({ name: "FACE_DETECTED", hint: "ok" })?.text, "Rostro detectado");
  assert.equal(bannerFor({ name: "FACE_DETECTED", hint: "ok" })?.tone, "ok");
  assert.equal(bannerFor({ name: "FACE_DETECTED", hint: "too_far" })?.text, "Acercate a la cámara");
  assert.equal(
    bannerFor({ name: "FACE_DETECTED", hint: "not_frontal" })?.text,
    "Mirá de frente a la cámara",
  );
  assert.equal(bannerFor({ name: "FACE_DETECTED", hint: "too_dark" })?.text, "Hace falta más luz");
  assert.equal(
    bannerFor({ name: "FACE_DETECTED", hint: "multiple_faces" })?.text,
    "Hay más de una persona en la imagen",
  );
  assert.equal(bannerFor({ name: "FACE_DETECTED", hint: "too_far" })?.tone, "warn");
});

test("each liveness challenge has its own prompt, pulsing", () => {
  const b = bannerFor({ name: "CHALLENGE", challenge: "smile" });
  assert.equal(b?.text, "Sonreí para confirmar");
  assert.equal(b?.pulse, true);
  assert.equal(bannerFor({ name: "CHALLENGE", challenge: "open_mouth" })?.text, "Abrí la boca para confirmar");
});

test("every processing stage says what the system is really doing", () => {
  assert.equal(bannerFor({ name: "CAPTURING", livenessPassed: true })?.text, "Capturando...");
  assert.equal(
    bannerFor({ name: "RECOGNIZING", livenessPassed: true })?.text,
    "Generando huella facial...",
  );
  assert.equal(
    bannerFor({ name: "VALIDATING_MEMBERSHIP" })?.text,
    "Verificando identidad y membresía...",
  );
});

test("results are shown by the result card, not by a banner", () => {
  for (const s of [
    { name: "ACCESS_GRANTED", result },
    { name: "ACCESS_DENIED", result },
    { name: "FACE_NOT_RECOGNIZED" },
  ] as KioskState[]) {
    assert.equal(bannerFor(s), null);
  }
});

test("an error shows its message", () => {
  const b = bannerFor({ name: "ERROR", message: "Permiso de cámara denegado", recoverable: false });
  assert.deepEqual(b, { text: "Permiso de cámara denegado", tone: "error", pulse: false });
});

test("the stages reflect real progress, with no percentages", () => {
  assert.deepEqual(stageStatuses({ name: "CAPTURING", livenessPassed: true }), [
    "active",
    "pending",
    "pending",
  ]);
  assert.deepEqual(stageStatuses({ name: "RECOGNIZING", livenessPassed: true }), [
    "done",
    "active",
    "pending",
  ]);
  assert.deepEqual(stageStatuses({ name: "VALIDATING_MEMBERSHIP" }), ["done", "done", "active"]);
  assert.equal(stageStatuses({ name: "DETECTING", requireExit: false, notBefore: 0 }), null);
});

import { resultViewFor, firstName } from "./kioskView.ts";

test("only the outcome states show the result card", () => {
  const granted = { name: "ACCESS_GRANTED", result } as KioskState;
  assert.deepEqual(resultViewFor(granted), { kind: "granted", result });
  assert.deepEqual(resultViewFor({ name: "ACCESS_DENIED", result } as KioskState), {
    kind: "denied",
    result,
  });
  assert.deepEqual(resultViewFor({ name: "FACE_NOT_RECOGNIZED" }), { kind: "not_recognized" });
  assert.deepEqual(
    resultViewFor({ name: "ERROR", message: "boom", recoverable: true }),
    { kind: "error", message: "boom" },
  );
});

test("a camera error stays on the camera overlay, not the result card", () => {
  assert.deepEqual(
    resultViewFor({ name: "ERROR", message: "sin permiso", recoverable: false }),
    { kind: "idle" },
  );
  for (const s of [
    { name: "IDLE" },
    { name: "DETECTING", requireExit: false, notBefore: 0 },
    { name: "FACE_DETECTED", hint: "ok" },
    { name: "VALIDATING_MEMBERSHIP" },
  ] as KioskState[]) {
    assert.deepEqual(resultViewFor(s), { kind: "idle" });
  }
});

test("only the first name is shown on the public screen", () => {
  assert.equal(firstName("Maria Fernanda Gomez"), "Maria");
  assert.equal(firstName("  Juan  "), "Juan");
  assert.equal(firstName(""), "");
});

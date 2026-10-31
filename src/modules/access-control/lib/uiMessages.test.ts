import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraErrorMessage, qualityMessage } from "./uiMessages.ts";

test("qualityMessage covers every quality reason in Spanish", () => {
  assert.equal(qualityMessage("no_face"), "No se detecta un rostro");
  assert.equal(qualityMessage("multiple_faces"), "Hay más de una persona en la imagen");
  assert.equal(qualityMessage("too_far"), "Acercate a la cámara");
  assert.equal(qualityMessage("not_frontal"), "Mirá de frente a la cámara");
  assert.equal(qualityMessage("too_dark"), "Hace falta más luz");
});

test("cameraErrorMessage covers every camera and model failure", () => {
  assert.match(cameraErrorMessage("denied"), /Permiso de cámara denegado/);
  assert.match(cameraErrorMessage("not_found"), /No se encontró una cámara/);
  assert.match(cameraErrorMessage("in_use"), /otra aplicación/);
  assert.match(cameraErrorMessage("unsupported"), /HTTPS/);
  assert.match(cameraErrorMessage("model"), /modelos de reconocimiento/);
});

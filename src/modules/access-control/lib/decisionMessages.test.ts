import { test } from "node:test";
import assert from "node:assert/strict";
import { reasonMessage } from "./decisionMessages.ts";

const expected: Record<string, string> = {
  ok: "Acceso autorizado",
  client_not_found: "Cliente no encontrado",
  client_inactive: "Cliente inactivo",
  no_subscription: "Sin membresía",
  subscription_pending_payment: "Membresía con pago pendiente",
  subscription_scheduled: "La membresía todavía no comenzó",
  subscription_expired: "Membresía vencida",
  subscription_canceled: "Membresía cancelada",
  face_not_recognized: "Rostro no reconocido",
  recently_admitted: "Ya registraste tu ingreso",
  liveness_failed: "No se pudo verificar que sea una persona real",
};

for (const [code, message] of Object.entries(expected)) {
  test(`reasonMessage maps ${code}`, () => {
    assert.equal(reasonMessage(code), message);
  });
}

test("an unknown code falls back to a generic denial", () => {
  assert.equal(reasonMessage("something_new"), "Acceso denegado");
});

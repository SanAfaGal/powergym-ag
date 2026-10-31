import { test } from "node:test";
import assert from "node:assert/strict";
import { rpcErrorMessage } from "./errorMessages.ts";

const FALLBACK = "No se pudo completar la acción";

const known: Record<string, string> = {
  "consent required": "Falta el consentimiento biométrico del cliente",
  "admin only": "Solo un administrador puede hacer esto",
  "client not found": "El cliente no existe",
  "staff only": "No tenés permisos para esta acción",
  "invalid embedding": "No se pudo leer el rostro, intentá de nuevo",
  "invalid threshold": "El umbral debe estar entre 0 y 1",
  "invalid challenges":
    "Elegí al menos una prueba de vida válida",
  "invalid photo path": "No se pudo guardar la foto",
  "invalid cooldown": "La espera entre ingresos debe estar entre 0 y 60 minutos",
};

for (const [raw, message] of Object.entries(known)) {
  test(`rpcErrorMessage maps "${raw}"`, () => {
    assert.equal(rpcErrorMessage(raw, FALLBACK), message);
  });
}

test("an unrecognized database error never leaks: it becomes the fallback", () => {
  assert.equal(
    rpcErrorMessage('relation "face_templates" does not exist', FALLBACK),
    FALLBACK,
  );
});

test("matching is exact, not a substring", () => {
  assert.equal(rpcErrorMessage("consent required (extra)", FALLBACK), FALLBACK);
});

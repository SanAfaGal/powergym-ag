import { test } from "node:test";
import assert from "node:assert/strict";
import { clientSchema } from "./schema.ts";

const valid = { first_name: "Ana", last_name: "Pérez" };

function messages(values: Record<string, unknown>) {
  const result = clientSchema.safeParse({ ...valid, ...values });
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

function yearsAgo(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

test("only a first and last name are required", () => {
  assert.equal(clientSchema.safeParse(valid).success, true);
  assert.equal(clientSchema.safeParse({ first_name: "Ana" }).success, false);
});

test("names accept accents, ñ, hyphens and apostrophes but not digits", () => {
  assert.equal(
    messages({ first_name: "María José", last_name: "Núñez-O'Neil" }).length,
    0,
  );
  assert.equal(messages({ first_name: "Ana2" }).length, 1);
  assert.equal(messages({ first_name: "A" }).length, 1);
  // a blank name trips both the required and the letters-only rules
  assert.equal(messages({ last_name: "   " })[0], "last_name: El apellido es obligatorio");
});

test("names are trimmed before validation", () => {
  const result = clientSchema.safeParse({
    first_name: "  Ana  ",
    last_name: " Pérez ",
  });
  assert.ok(result.success);
  assert.equal(result.data.first_name, "Ana");
});

test("a phone must be a 10-digit Colombian mobile starting with 3", () => {
  assert.equal(messages({ phone: "3001234567" }).length, 0);
  assert.equal(messages({ phone: "" }).length, 0);
  assert.equal(messages({ phone: "2001234567" }).length, 1);
  assert.equal(messages({ phone: "300123456" }).length, 1);
  assert.equal(messages({ phone: "+573001234567" }).length, 1);
  assert.equal(messages({ alternative_phone: "12345" }).length, 1);
});

test("a document type and number must come together", () => {
  assert.deepEqual(messages({ dni_number: "12345678" }), [
    "dni_type: Seleccioná el tipo de documento",
  ]);
  assert.deepEqual(messages({ dni_type: "CC" }), [
    "dni_number: Ingresá el número de documento",
  ]);
  assert.equal(messages({ dni_type: "CC", dni_number: "12345678" }).length, 0);
});

test("the document number is checked against its own type", () => {
  assert.equal(messages({ dni_type: "CC", dni_number: "12345" }).length, 1);
  assert.equal(messages({ dni_type: "CC", dni_number: "12345678901" }).length, 1);
  assert.equal(messages({ dni_type: "CC", dni_number: "12A45678" }).length, 1);
  assert.equal(messages({ dni_type: "CE", dni_number: "A12345" }).length, 0);
  assert.equal(messages({ dni_type: "PP", dni_number: "AB1234567" }).length, 0);
  assert.equal(messages({ dni_type: "TI", dni_number: "1234567" }).length, 1);
});

test("an unknown document type is not pattern-checked", () => {
  assert.equal(messages({ dni_type: "XX", dni_number: "whatever" }).length, 0);
});

test("email is optional but must be valid when present", () => {
  assert.equal(messages({ email: "" }).length, 0);
  assert.equal(messages({ email: "ana@example.com" }).length, 0);
  assert.equal(messages({ email: "ana@" }).length, 1);
  assert.ok(messages({ email: `${"a".repeat(120)}@example.com` }).length >= 1);
});

test("birth date must be real, not in the future and not over 100 years ago", () => {
  assert.equal(messages({ birth_date: "1990-05-20" }).length, 0);
  assert.equal(messages({ birth_date: "" }).length, 0);
  assert.equal(messages({ birth_date: "no es fecha" }).length, 1);
  assert.equal(messages({ birth_date: "2999-01-01" }).length, 1);
  assert.equal(messages({ birth_date: yearsAgo(101) }).length, 1);
  assert.equal(messages({ birth_date: yearsAgo(99) }).length, 0);
});

test("an address needs 5 to 120 characters when present", () => {
  assert.equal(messages({ address: "" }).length, 0);
  assert.equal(messages({ address: "Cra 7" }).length, 0);
  assert.equal(messages({ address: "Cra" }).length, 1);
  assert.equal(messages({ address: "x".repeat(121) }).length, 1);
});

test("an alias allows digits but not symbols", () => {
  assert.equal(messages({ alias: "Pepe99" }).length, 0);
  assert.equal(messages({ alias: "P" }).length, 1);
  assert.equal(messages({ alias: "pepe@!" }).length, 1);
});

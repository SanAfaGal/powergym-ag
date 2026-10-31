import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateValue, maskDateInput, parseTypedDate } from "./dateInput.ts";

test("maskDateInput keeps digits only and adds the slashes as you type", () => {
  assert.equal(maskDateInput(""), "");
  assert.equal(maskDateInput("1"), "1");
  assert.equal(maskDateInput("12"), "12");
  assert.equal(maskDateInput("123"), "12/3");
  assert.equal(maskDateInput("12102"), "12/10/2");
  assert.equal(maskDateInput("12102026"), "12/10/2026");
  assert.equal(maskDateInput("12/10/2026"), "12/10/2026");
  assert.equal(maskDateInput("12-10-2026 extra 99"), "12/10/2026");
  assert.equal(maskDateInput("ab"), "");
});

test("parseTypedDate turns a complete dd/mm/yyyy into yyyy-MM-dd", () => {
  assert.equal(parseTypedDate("05/03/1990", {}), "1990-03-05");
  assert.equal(parseTypedDate("29/02/2024", {}), "2024-02-29");
});

test("parseTypedDate rejects incomplete and impossible dates", () => {
  assert.equal(parseTypedDate("05/03/19", {}), null);
  assert.equal(parseTypedDate("31/04/2024", {}), null);
  assert.equal(parseTypedDate("29/02/2023", {}), null);
  assert.equal(parseTypedDate("00/01/2024", {}), null);
  assert.equal(parseTypedDate("10/13/2024", {}), null);
  assert.equal(parseTypedDate("", {}), null);
});

test("parseTypedDate accepts old dates (birth dates) and refuses years before 1900", () => {
  assert.equal(parseTypedDate("01/01/1950", {}), "1950-01-01");
  assert.equal(parseTypedDate("01/01/1899", {}), null);
});

test("parseTypedDate respects min and max, both inclusive", () => {
  const range = { min: "2026-10-10", max: "2026-10-20" };
  assert.equal(parseTypedDate("10/10/2026", range), "2026-10-10");
  assert.equal(parseTypedDate("20/10/2026", range), "2026-10-20");
  assert.equal(parseTypedDate("09/10/2026", range), null);
  assert.equal(parseTypedDate("21/10/2026", range), null);
});

test("formatDateValue shows yyyy-MM-dd as dd/mm/yyyy", () => {
  assert.equal(formatDateValue("1990-03-05"), "05/03/1990");
  assert.equal(formatDateValue(undefined), "");
  assert.equal(formatDateValue(""), "");
});

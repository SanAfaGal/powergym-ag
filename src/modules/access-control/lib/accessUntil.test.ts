import { test } from "node:test";
import assert from "node:assert/strict";
import { describeAccessUntil } from "./accessUntil.ts";

const TODAY = "2026-10-31";

function must(end: string, today: string) {
  const r = describeAccessUntil(end, today);
  assert.ok(r);
  return r;
}

test("a future end date says until which day the client can enter", () => {
  const r = must("2026-11-14", TODAY);
  assert.match(r.headline, /^Puede ingresar hasta el /);
  assert.match(r.headline, /14 de noviembre/);
  assert.equal(r.detail, "Le quedan 14 días");
  assert.equal(r.tone, "ok");
});

test("one day left is singular", () => {
  const r = must("2026-11-01", TODAY);
  assert.equal(r.detail, "Le queda 1 día");
  assert.equal(r.tone, "ok");
});

test("the last day is called out", () => {
  const r = must(TODAY, TODAY);
  assert.equal(r.headline, "Hoy es su último día de acceso");
  assert.equal(r.detail, null);
  assert.equal(r.tone, "last");
});

test("a lapsed membership says when it ended", () => {
  const r = must("2026-10-21", TODAY);
  assert.match(r.headline, /^Su membresía venció el /);
  assert.match(r.headline, /21 de octubre/);
  assert.equal(r.detail, "Hace 10 días");
  assert.equal(r.tone, "expired");
});

test("one day ago is singular", () => {
  assert.equal(must("2026-10-30", TODAY).detail, "Hace 1 día");
});

test("the count crosses month and year boundaries correctly", () => {
  assert.equal(must("2027-01-02", "2026-12-30").detail, "Le quedan 3 días");
});

test("an unparseable date yields no text", () => {
  assert.equal(describeAccessUntil("not-a-date", TODAY), null);
});

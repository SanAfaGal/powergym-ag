import { test } from "node:test";
import assert from "node:assert/strict";
import { bogotaRange } from "./dateRange.ts";

test("a from date starts at Bogota midnight", () => {
  assert.deepEqual(bogotaRange("2026-10-31", undefined), {
    fromIso: "2026-10-31T00:00:00-05:00",
    toExclusiveIso: undefined,
  });
});

test("a to date is inclusive: the bound is midnight of the NEXT day", () => {
  assert.deepEqual(bogotaRange(undefined, "2026-10-31"), {
    fromIso: undefined,
    toExclusiveIso: "2026-11-01T00:00:00-05:00",
  });
});

test("the next day rolls over months and years", () => {
  assert.equal(bogotaRange(undefined, "2026-12-31").toExclusiveIso, "2027-01-01T00:00:00-05:00");
  assert.equal(bogotaRange(undefined, "2028-02-28").toExclusiveIso, "2028-02-29T00:00:00-05:00");
});

test("invalid or empty dates are ignored", () => {
  assert.deepEqual(bogotaRange("nope", ""), { fromIso: undefined, toExclusiveIso: undefined });
  assert.deepEqual(bogotaRange("2026-13-45", undefined), {
    fromIso: undefined,
    toExclusiveIso: undefined,
  });
});

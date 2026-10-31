import { test } from "node:test";
import assert from "node:assert/strict";
import { planEditSchema, planSchema, priceSchema } from "./schema.ts";
import { bogotaToday } from "../../lib/date/bogota.ts";

function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = bogotaToday();
const plan = {
  name: "Mensual",
  description: "",
  duration_unit: "month",
  duration_count: 1,
  price: 90000,
  valid_from: today,
};

test("a complete plan is valid", () => {
  assert.equal(planSchema.safeParse(plan).success, true);
});

test("the plan name needs 2 to 80 characters after trimming", () => {
  assert.equal(planSchema.safeParse({ ...plan, name: "M" }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, name: "  M  " }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, name: "x".repeat(81) }).success, false);
});

test("the duration unit must be day, week, month or year", () => {
  for (const unit of ["day", "week", "month", "year"]) {
    assert.equal(planSchema.safeParse({ ...plan, duration_unit: unit }).success, true);
  }
  assert.equal(planSchema.safeParse({ ...plan, duration_unit: "decade" }).success, false);
});

test("the duration count is an integer from 1 to 3650", () => {
  assert.equal(planSchema.safeParse({ ...plan, duration_count: 0 }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, duration_count: 1.5 }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, duration_count: 3650 }).success, true);
  assert.equal(planSchema.safeParse({ ...plan, duration_count: 3651 }).success, false);
});

test("a blank duration or price (NaN) gets the Spanish message", () => {
  const result = planSchema.safeParse({
    ...plan,
    duration_count: Number.NaN,
    price: Number.NaN,
  });
  assert.ok(!result.success);
  assert.ok(result.error.issues.every((i) => i.message === "Ingresá un número"));
});

test("the price is positive with at most 2 decimals", () => {
  assert.equal(planSchema.safeParse({ ...plan, price: 0 }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, price: -5 }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, price: 100.999 }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, price: 100.5 }).success, true);
});

test("a new plan may start in the past or the future", () => {
  assert.equal(planSchema.safeParse({ ...plan, valid_from: shiftDay(today, -90) }).success, true);
  assert.equal(planSchema.safeParse({ ...plan, valid_from: shiftDay(today, 30) }).success, true);
  assert.equal(planSchema.safeParse({ ...plan, valid_from: "" }).success, false);
});

test("editing a plan does not carry a price", () => {
  const edit = {
    name: plan.name,
    description: plan.description,
    duration_unit: plan.duration_unit,
    duration_count: plan.duration_count,
  };
  assert.equal(planEditSchema.safeParse(edit).success, true);
  const parsed = planEditSchema.parse({ ...edit, price: 1 });
  assert.equal("price" in parsed, false);
});

test("a scheduled price change cannot take effect in the past", () => {
  assert.equal(priceSchema.safeParse({ price: 95000, valid_from: today }).success, true);
  assert.equal(
    priceSchema.safeParse({ price: 95000, valid_from: shiftDay(today, 7) }).success,
    true,
  );
  assert.equal(
    priceSchema.safeParse({ price: 95000, valid_from: shiftDay(today, -1) }).success,
    false,
  );
  assert.equal(priceSchema.safeParse({ price: 95000, valid_from: "" }).success, false);
  assert.equal(priceSchema.safeParse({ price: 0, valid_from: today }).success, false);
});

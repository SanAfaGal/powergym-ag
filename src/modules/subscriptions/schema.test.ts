import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelSchema, paymentSchema, subscriptionSchema } from "./schema.ts";
import { bogotaToday } from "../../lib/date/bogota.ts";

function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = bogotaToday();

test("a subscription needs a plan and a start date", () => {
  assert.equal(
    subscriptionSchema.safeParse({ plan_id: "p1", start_date: today }).success,
    true,
  );
  assert.equal(
    subscriptionSchema.safeParse({ plan_id: "", start_date: today }).success,
    false,
  );
  assert.equal(
    subscriptionSchema.safeParse({ plan_id: "p1", start_date: "" }).success,
    false,
  );
});

test("the discount is optional, non-negative and has at most 2 decimals", () => {
  const base = { plan_id: "p1", start_date: today };
  assert.equal(subscriptionSchema.safeParse(base).success, true);
  assert.equal(subscriptionSchema.safeParse({ ...base, discount_amount: 0 }).success, true);
  assert.equal(subscriptionSchema.safeParse({ ...base, discount_amount: 5000.5 }).success, true);
  assert.equal(subscriptionSchema.safeParse({ ...base, discount_amount: -1 }).success, false);
  assert.equal(subscriptionSchema.safeParse({ ...base, discount_amount: 1.005 }).success, false);
});

test("a blank number input (NaN) gets the Spanish message, not zod's English one", () => {
  const result = subscriptionSchema.safeParse({
    plan_id: "p1",
    start_date: today,
    discount_amount: Number.NaN,
  });
  assert.ok(!result.success);
  assert.equal(result.error.issues[0].message, "Ingresá un número");
});

const payment = {
  amount: 50000,
  payment_method: "cash",
  payment_date: today,
};

test("a payment amount must be positive with at most 2 decimals", () => {
  assert.equal(paymentSchema.safeParse(payment).success, true);
  assert.equal(paymentSchema.safeParse({ ...payment, amount: 0 }).success, false);
  assert.equal(paymentSchema.safeParse({ ...payment, amount: -10 }).success, false);
  assert.equal(paymentSchema.safeParse({ ...payment, amount: 10.123 }).success, false);
  assert.equal(paymentSchema.safeParse({ ...payment, amount: 10.5 }).success, true);
});

test("a payment needs a method", () => {
  assert.equal(paymentSchema.safeParse({ ...payment, payment_method: "" }).success, false);
});

test("a payment cannot be dated after today (Bogota)", () => {
  assert.equal(
    paymentSchema.safeParse({ ...payment, payment_date: shiftDay(today, 1) }).success,
    false,
  );
  assert.equal(
    paymentSchema.safeParse({ ...payment, payment_date: shiftDay(today, -30) }).success,
    true,
  );
  assert.equal(paymentSchema.safeParse({ ...payment, payment_date: "" }).success, false);
});

test("the bank account and notes are optional, notes capped at 300", () => {
  assert.equal(paymentSchema.safeParse({ ...payment, bank_account_id: "" }).success, true);
  assert.equal(paymentSchema.safeParse({ ...payment, bank_account_id: "acc" }).success, true);
  assert.equal(paymentSchema.safeParse({ ...payment, notes: "x".repeat(300) }).success, true);
  assert.equal(paymentSchema.safeParse({ ...payment, notes: "x".repeat(301) }).success, false);
});

test("a cancellation needs a reason of 3 to 300 characters after trimming", () => {
  assert.equal(cancelSchema.safeParse({ reason: "Se mudó" }).success, true);
  assert.equal(cancelSchema.safeParse({ reason: "  ab  " }).success, false);
  assert.equal(cancelSchema.safeParse({ reason: "" }).success, false);
  assert.equal(cancelSchema.safeParse({ reason: "x".repeat(301) }).success, false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createStabilityTracker } from "./stability.ts";

test("fires only after N consecutive ok frames", () => {
  const t = createStabilityTracker(3);
  assert.equal(t.push(true), false);
  assert.equal(t.push(true), false);
  assert.equal(t.push(true), true);
});

test("a bad frame resets the streak", () => {
  const t = createStabilityTracker(3);
  t.push(true);
  t.push(true);
  assert.equal(t.push(false), false);
  assert.equal(t.push(true), false);
  assert.equal(t.push(true), false);
  assert.equal(t.push(true), true);
});

test("after firing it must rebuild the full streak before firing again", () => {
  const t = createStabilityTracker(2);
  t.push(true);
  assert.equal(t.push(true), true);
  assert.equal(t.push(true), false);
  assert.equal(t.push(true), true);
});

test("reset clears the streak", () => {
  const t = createStabilityTracker(2);
  t.push(true);
  t.reset();
  assert.equal(t.push(true), false);
});

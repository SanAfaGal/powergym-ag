import { test } from "node:test";
import assert from "node:assert/strict";
import { createContinuityTracker } from "./continuity.ts";

const at = (x: number, y: number) => ({ x, y });

test("a steady face stays ok", () => {
  const t = createContinuityTracker();
  assert.equal(t.push(at(0.5, 0.5), 1), "ok");
  assert.equal(t.push(at(0.51, 0.5), 1), "ok");
  assert.equal(t.push(at(0.52, 0.49), 1), "ok");
});

test("a second face breaks continuity at once", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 1);
  assert.equal(t.push(at(0.5, 0.5), 2), "broken");
});

test("a face that jumps across the frame is a different face", () => {
  const t = createContinuityTracker({ maxJump: 0.2 });
  t.push(at(0.3, 0.5), 1);
  assert.equal(t.push(at(0.7, 0.5), 1), "broken");
});

test("a short gap with no face is tolerated, a long one is not", () => {
  const t = createContinuityTracker({ maxLostFrames: 3 });
  t.push(at(0.5, 0.5), 1);
  assert.equal(t.push(null, 0), "ok");
  assert.equal(t.push(null, 0), "ok");
  assert.equal(t.push(null, 0), "ok");
  assert.equal(t.push(null, 0), "broken");
});

test("someone else stepping into the spot after a gap is caught by the jump check", () => {
  const t = createContinuityTracker({ maxJump: 0.2, maxLostFrames: 5 });
  t.push(at(0.2, 0.5), 1);
  t.push(null, 0);
  assert.equal(t.push(at(0.8, 0.5), 1), "broken");
});

test("once broken it stays broken", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 2);
  assert.equal(t.push(at(0.5, 0.5), 1), "broken");
});

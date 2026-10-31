import { test } from "node:test";
import assert from "node:assert/strict";
import { createLivenessSession } from "./liveness.ts";

const open = (yaw = 0) => ({ eyesClosed: false, yaw });
const closed = (yaw = 0) => ({ eyesClosed: true, yaw });

test("a full blink (open, closed, open) passes", () => {
  const s = createLivenessSession("blink", 5000);
  assert.equal(s.update(open(), 0), "pending");
  assert.equal(s.update(closed(), 100), "pending");
  assert.equal(s.update(open(), 200), "passed");
});

test("eyes that stay open until the timeout fail", () => {
  const s = createLivenessSession("blink", 5000);
  assert.equal(s.update(open(), 0), "pending");
  assert.equal(s.update(open(), 4000), "pending");
  assert.equal(s.update(open(), 5001), "failed");
});

test("a blink that starts with eyes already closed does not count", () => {
  const s = createLivenessSession("blink", 5000);
  assert.equal(s.update(closed(), 0), "pending");
  assert.equal(s.update(open(), 100), "pending");
});

test("turn_left passes at yaw <= -15 and turn_right at yaw >= 15", () => {
  const left = createLivenessSession("turn_left", 5000);
  assert.equal(left.update(open(0), 0), "pending");
  assert.equal(left.update(open(-15), 100), "passed");
  const right = createLivenessSession("turn_right", 5000);
  assert.equal(right.update(open(0), 0), "pending");
  assert.equal(right.update(open(15), 100), "passed");
});

test("turning the wrong way does not pass", () => {
  const s = createLivenessSession("turn_left", 5000);
  assert.equal(s.update(open(0), 0), "pending");
  assert.equal(s.update(open(40), 100), "pending");
  assert.equal(s.update(open(40), 6000), "failed");
});

test("a NaN yaw never passes a turn challenge", () => {
  const s = createLivenessSession("turn_right", 5000);
  assert.equal(s.update(open(NaN), 0), "pending");
  assert.equal(s.update(open(NaN), 100), "pending");
});

test("once passed or failed the state is final", () => {
  const passed = createLivenessSession("turn_right", 5000);
  passed.update(open(0), 0);
  passed.update(open(30), 100);
  assert.equal(passed.update(open(0), 200), "passed");

  const failed = createLivenessSession("turn_right", 1000);
  failed.update(open(0), 0);
  failed.update(open(0), 2000);
  assert.equal(failed.update(open(30), 2100), "failed");
});

test("a turn challenge never passes on a first frame that is already turned", () => {
  const s = createLivenessSession("turn_left", 5000);
  assert.equal(s.update(open(-40), 0), "pending");
  assert.equal(s.update(open(-40), 100), "pending");
});

test("a turn only counts after a frontal frame was seen first", () => {
  const s = createLivenessSession("turn_right", 5000);
  assert.equal(s.update(open(40), 0), "pending");
  assert.equal(s.update(open(3), 100), "pending");
  assert.equal(s.update(open(40), 200), "passed");
});

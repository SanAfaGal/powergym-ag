import { test } from "node:test";
import assert from "node:assert/strict";
import { createContinuityTracker } from "./continuity.ts";

const at = (x: number, y: number) => ({ x, y });

test("a steady face stays ok", () => {
  const t = createContinuityTracker();
  assert.equal(t.push(at(0.5, 0.5), 1, 0.4), "ok");
  assert.equal(t.push(at(0.51, 0.5), 1, 0.41), "ok");
  assert.equal(t.push(at(0.52, 0.49), 1, 0.4), "ok");
});

test("a second face breaks continuity at once", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 1, 0.4);
  assert.equal(t.push(at(0.5, 0.5), 2, 0.4), "broken");
});

test("a face that jumps across the frame is a different face", () => {
  const t = createContinuityTracker();
  t.push(at(0.3, 0.5), 1, 0.4);
  assert.equal(t.push(at(0.7, 0.5), 1, 0.4), "broken");
});

test("even a modest jump is too much between two consecutive frames", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 1, 0.4);
  assert.equal(t.push(at(0.65, 0.5), 1, 0.4), "broken");
});

test("any frame without the face breaks continuity", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 1, 0.4);
  assert.equal(t.push(null, 0, 0), "broken");
});

test("a frame with one face but no mesh counts as lost", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 1, 0.4);
  assert.equal(t.push(null, 1, 0.4), "broken");
});

test("a sudden change in face size is a different face (or a photo swap)", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 1, 0.4);
  assert.equal(t.push(at(0.5, 0.5), 1, 0.2), "broken");
});

test("once broken it stays broken", () => {
  const t = createContinuityTracker();
  t.push(at(0.5, 0.5), 2, 0.4);
  assert.equal(t.push(at(0.5, 0.5), 1, 0.4), "broken");
});

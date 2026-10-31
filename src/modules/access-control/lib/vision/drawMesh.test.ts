import { test } from "node:test";
import assert from "node:assert/strict";
import { drawFaceMesh, type MeshContext } from "./drawMesh.ts";

function recorder() {
  const calls: string[] = [];
  const ctx = {
    strokeStyle: "",
    lineWidth: 0,
    clearRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`clear ${x},${y},${w},${h}`),
    beginPath: () => calls.push("begin"),
    moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
    stroke: () => calls.push("stroke"),
  } as unknown as MeshContext;
  return { ctx, calls };
}

const lm = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0.5 },
  { x: 1, y: 1 },
];

test("it clears the canvas and draws one scaled segment per connection", () => {
  const { ctx, calls } = recorder();
  drawFaceMesh(ctx, lm, [{ start: 0, end: 1 }, { start: 1, end: 2 }], 100, 200, "lime");
  assert.equal(calls[0], "clear 0,0,100,200");
  assert.equal(calls.filter((c) => c.startsWith("line")).length, 2);
  assert.ok(calls.includes("move 50,100"));
  assert.ok(calls.includes("line 100,200"));
  assert.equal(ctx.strokeStyle, "lime");
});

test("a null face only clears the canvas", () => {
  const { ctx, calls } = recorder();
  drawFaceMesh(ctx, null, [{ start: 0, end: 1 }], 100, 200, "lime");
  assert.deepEqual(calls, ["clear 0,0,100,200"]);
});

test("connections that point at a missing landmark are skipped", () => {
  const { ctx, calls } = recorder();
  drawFaceMesh(ctx, lm, [{ start: 0, end: 9 }, { start: 0, end: 1 }], 100, 200, "lime");
  assert.equal(calls.filter((c) => c.startsWith("line")).length, 1);
});

import { faceBounds, drawFaceFrame } from "./drawMesh.ts";

test("faceBounds is the box around all the landmarks", () => {
  const box = faceBounds([{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.9 }, { x: 0.4, y: 0.5 }]);
  assert.ok(box);
  assert.ok(Math.abs(box.x - 0.2) < 1e-9 && Math.abs(box.y - 0.3) < 1e-9);
  assert.ok(Math.abs(box.width - 0.4) < 1e-9 && Math.abs(box.height - 0.6) < 1e-9);
  assert.equal(faceBounds([]), null);
});

test("drawFaceFrame draws four corner brackets (8 segments) scaled to the canvas", () => {
  const calls: string[] = [];
  const ctx = {
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    clearRect: () => calls.push("clear"),
    beginPath: () => calls.push("begin"),
    moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
    stroke: () => calls.push("stroke"),
  } as unknown as MeshContext;
  drawFaceFrame(ctx, [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }], 100, 200, "lime");
  assert.equal(calls.filter((c) => c.startsWith("line")).length, 8);
  // box (25,50)-(75,150); each bracket arm is 22% of the shorter side = 11
  assert.ok(calls.includes("move 25,61"), "starts on the left edge of the top-left corner");
  assert.ok(calls.includes("line 25,50"), "turns at the top-left corner");
  assert.equal(calls.includes("clear"), false, "it must not wipe the mesh drawn before it");
  assert.equal(ctx.strokeStyle, "lime");
});

test("drawFaceFrame does nothing without a face", () => {
  const calls: string[] = [];
  const ctx = { strokeStyle: "", lineWidth: 0, lineCap: "", beginPath: () => calls.push("b") } as unknown as MeshContext;
  drawFaceFrame(ctx, null, 100, 200, "lime");
  assert.deepEqual(calls, []);
});

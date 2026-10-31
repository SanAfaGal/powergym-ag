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

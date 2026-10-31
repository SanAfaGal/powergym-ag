import { test } from "node:test";
import assert from "node:assert/strict";
import { portraitCrop } from "./portraitCrop.ts";

// 640x480 video, a face 200 px wide and 260 px tall centered at (320, 240)
const W = 640;
const H = 480;
const face = { x: 220 / W, y: 110 / H, width: 200 / W, height: 260 / H };

test("the crop is 4:5 and stays inside the video", () => {
  const c = portraitCrop(face, W, H);
  assert.ok(Math.abs(c.sw / c.sh - 4 / 5) < 0.01);
  assert.ok(c.sx >= 0 && c.sy >= 0);
  assert.ok(c.sx + c.sw <= W + 1e-6 && c.sy + c.sh <= H + 1e-6);
});

test("a centered face ends up centered horizontally with room around it", () => {
  const c = portraitCrop(face, W, H);
  const faceCenterX = 320;
  assert.ok(Math.abs(c.sx + c.sw / 2 - faceCenterX) < 1);
  // the face takes well under the whole width: there is space on both sides
  assert.ok(200 / c.sw < 0.7);
});

// The mesh stops at the forehead and the chin; the head (hair included) goes
// about 30% of the face height above and a little below.
const headTop = (f: typeof face) => (f.y - 0.3 * f.height) * H;
const headBottom = (f: typeof face) => (f.y + 1.05 * f.height) * H;

test("the whole head fits in the crop, with room above and below", () => {
  const c = portraitCrop(face, W, H);
  assert.ok(c.sy < headTop(face), "room above the hair");
  assert.ok(c.sy + c.sh > headBottom(face), "room below the chin");
});

test("the head is centered vertically, not the face", () => {
  const c = portraitCrop(face, W, H);
  const headCenter = (headTop(face) + headBottom(face)) / 2;
  assert.ok(Math.abs(c.sy + c.sh / 2 - headCenter) < 1);
});

test("an off-center face still gets its whole head, centered on both axes", () => {
  // face center at (400, 250): right of the middle, head fully inside the frame
  const off = { x: 300 / W, y: 120 / H, width: 200 / W, height: 260 / H };
  const c = portraitCrop(off, W, H);
  assert.ok(Math.abs(c.sx + c.sw / 2 - 400) < 1);
  assert.ok(Math.abs(c.sy + c.sh / 2 - (headTop(off) + headBottom(off)) / 2) < 1);
  assert.ok(c.sx >= 0 && c.sy >= 0 && c.sx + c.sw <= W && c.sy + c.sh <= H);
  assert.ok(c.sy <= headTop(off) && c.sy + c.sh >= headBottom(off));
});

test("a face near the edge is shifted in, never cropped outside the frame", () => {
  const edge = { x: 0.02, y: 0.1, width: 200 / W, height: 260 / H };
  const c = portraitCrop(edge, W, H);
  assert.equal(c.sx, 0);
  assert.ok(c.sy >= 0 && c.sy + c.sh <= H + 1e-6);
});

test("a large face still gets a crop that fits", () => {
  const big = { x: 0.1, y: 0.02, width: 0.8, height: 0.96 };
  const c = portraitCrop(big, W, H);
  assert.ok(c.sw <= W && c.sh <= H);
  assert.ok(Math.abs(c.sw / c.sh - 4 / 5) < 0.01);
});

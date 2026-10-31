import { test } from "node:test";
import assert from "node:assert/strict";
import { imageDataToTensor, meanBrightness } from "./preprocess.ts";

test("imageDataToTensor lays out CHW, RGB, normalized to [-1, 1]", () => {
  // 2x1 image: pixel 0 = (255, 0, 0, 255), pixel 1 = (0, 255, 0, 255)
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
  const t = imageDataToTensor(rgba, 2, 1);
  assert.equal(t.length, 6);
  // R plane, G plane, B plane
  assert.deepEqual(Array.from(t.slice(0, 2)), [1, -1]);
  assert.deepEqual(Array.from(t.slice(2, 4)), [-1, 1]);
  assert.deepEqual(Array.from(t.slice(4, 6)), [-1, -1]);
});

test("imageDataToTensor maps 127.5 to zero", () => {
  const rgba = new Uint8ClampedArray([128, 128, 128, 255]);
  const t = imageDataToTensor(rgba, 1, 1);
  assert.ok(Math.abs(t[0] - 1 / 255) < 1e-6);
});

test("imageDataToTensor rejects a buffer that does not match the size", () => {
  assert.throws(() => imageDataToTensor(new Uint8ClampedArray(4), 2, 2), /size/);
});

test("meanBrightness is 0 for black and 1 for white", () => {
  assert.equal(meanBrightness(new Uint8ClampedArray([0, 0, 0, 255])), 0);
  assert.equal(meanBrightness(new Uint8ClampedArray([255, 255, 255, 255])), 1);
});

test("meanBrightness weights green more than blue", () => {
  const green = meanBrightness(new Uint8ClampedArray([0, 255, 0, 255]));
  const blue = meanBrightness(new Uint8ClampedArray([0, 0, 255, 255]));
  assert.ok(green > blue);
});

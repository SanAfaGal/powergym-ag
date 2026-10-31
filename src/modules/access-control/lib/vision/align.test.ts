import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCFACE_TEMPLATE,
  applyTransform,
  estimateSimilarityTransform,
  type Point,
} from "./align.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const square: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

test("identical point sets give the identity transform", () => {
  const t = estimateSimilarityTransform(square, square);
  assert.ok(near(t.a, 1) && near(t.b, 0) && near(t.c, 0) && near(t.d, 1));
  assert.ok(near(t.e, 0) && near(t.f, 0));
});

test("a scale of 2 plus a translation is recovered", () => {
  const dst = square.map(([x, y]): Point => [2 * x + 10, 2 * y + 5]);
  const t = estimateSimilarityTransform(square, dst);
  assert.ok(near(t.a, 2) && near(t.b, 0) && near(t.d, 2));
  assert.ok(near(t.e, 10) && near(t.f, 5));
});

test("a 90 degree rotation is recovered in canvas setTransform order", () => {
  const dst = square.map(([x, y]): Point => [-y, x]);
  const t = estimateSimilarityTransform(square, dst);
  // x' = a*x + c*y + e, y' = b*x + d*y + f
  assert.ok(near(t.a, 0) && near(t.b, 1) && near(t.c, -1) && near(t.d, 0));
});

test("applyTransform maps source points onto the destination", () => {
  const dst = square.map(([x, y]): Point => [2 * x + 10, 2 * y + 5]);
  const t = estimateSimilarityTransform(square, dst);
  const [x, y] = applyTransform(t, [10, 10]);
  assert.ok(near(x, 30) && near(y, 25));
});

test("the ArcFace template has five points inside a 112x112 crop", () => {
  assert.equal(ARCFACE_TEMPLATE.length, 5);
  for (const [x, y] of ARCFACE_TEMPLATE) {
    assert.ok(x > 0 && x < 112 && y > 0 && y < 112);
  }
});

test("mismatched or degenerate inputs throw", () => {
  assert.throws(() => estimateSimilarityTransform(square, square.slice(1)), /same number/);
  assert.throws(() => estimateSimilarityTransform([[1, 1]], [[2, 2]]), /at least 2/);
  assert.throws(
    () => estimateSimilarityTransform([[1, 1], [1, 1]], [[0, 0], [5, 5]]),
    /degenerate/,
  );
});

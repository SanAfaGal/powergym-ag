import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMBEDDING_DIM,
  averageEmbeddings,
  cosineSimilarity,
  isValidEmbedding,
  l2Normalize,
  toPgVector,
} from "./embedding.ts";

const axis = (i: number): number[] =>
  Array.from({ length: EMBEDDING_DIM }, (_, k) => (k === i ? 1 : 0));
const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

test("EMBEDDING_DIM is 512", () => {
  assert.equal(EMBEDDING_DIM, 512);
});

test("isValidEmbedding accepts a finite, non-zero 512-d vector", () => {
  assert.equal(isValidEmbedding(axis(0)), true);
});

test("isValidEmbedding rejects a zero vector", () => {
  assert.equal(isValidEmbedding(new Array(EMBEDDING_DIM).fill(0)), false);
});

test("isValidEmbedding rejects NaN and Infinity entries", () => {
  const nan = axis(0);
  nan[3] = NaN;
  const inf = axis(0);
  inf[3] = Infinity;
  assert.equal(isValidEmbedding(nan), false);
  assert.equal(isValidEmbedding(inf), false);
});

test("isValidEmbedding rejects wrong dimensions and non-arrays", () => {
  assert.equal(isValidEmbedding(axis(0).slice(0, 511)), false);
  assert.equal(isValidEmbedding([...axis(0), 0]), false);
  assert.equal(isValidEmbedding(null), false);
  assert.equal(isValidEmbedding("[1,0]"), false);
});

test("l2Normalize returns a unit vector in the same direction", () => {
  const v = l2Normalize([3, 4]);
  assert.ok(Math.abs(norm(v) - 1) < 1e-9);
  assert.ok(Math.abs(v[0] - 0.6) < 1e-9);
});

test("l2Normalize throws on a zero vector", () => {
  assert.throws(() => l2Normalize([0, 0, 0]), /zero vector/);
});

test("averageEmbeddings of three axes is renormalized to unit length", () => {
  const avg = averageEmbeddings([axis(0), axis(1), axis(2)]);
  assert.ok(Math.abs(norm(avg) - 1) < 1e-9);
  assert.ok(Math.abs(avg[0] - 1 / Math.sqrt(3)) < 1e-9);
});

test("averageEmbeddings throws on an empty list", () => {
  assert.throws(() => averageEmbeddings([]), /no embeddings/);
});

test("toPgVector formats the exact pgvector text literal", () => {
  assert.equal(toPgVector([1, 0.5, 0]), "[1,0.5,0]");
});

test("cosineSimilarity is 1 for identical directions and 0 for orthogonal ones", () => {
  assert.ok(Math.abs(cosineSimilarity(axis(0), axis(0)) - 1) < 1e-9);
  assert.ok(Math.abs(cosineSimilarity(axis(0), axis(1))) < 1e-9);
});

test("cosineSimilarity ignores vector length", () => {
  const doubled = axis(2).map((x) => x * 2);
  assert.ok(Math.abs(cosineSimilarity(doubled, axis(2)) - 1) < 1e-9);
});

test("cosineSimilarity throws on mismatched sizes or a zero vector", () => {
  assert.throws(() => cosineSimilarity([1, 0], [1]), /dimension/);
  assert.throws(() => cosineSimilarity([0, 0], [1, 0]), /zero vector/);
});

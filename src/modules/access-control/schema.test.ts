import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attemptSchema,
  embeddingSchema,
  enrollSchema,
  settingsSchema,
} from "./schema.ts";

const axis = (i: number): number[] =>
  Array.from({ length: 512 }, (_, k) => (k === i ? 1 : 0));
const uuid = "123e4567-e89b-42d3-a456-426614174000";

test("embeddingSchema accepts a valid 512-d vector", () => {
  assert.equal(embeddingSchema.safeParse(axis(0)).success, true);
});

test("embeddingSchema rejects NaN, wrong size and zero vectors", () => {
  const nan = axis(0);
  nan[1] = NaN;
  assert.equal(embeddingSchema.safeParse(nan).success, false);
  assert.equal(embeddingSchema.safeParse(axis(0).slice(1)).success, false);
  assert.equal(embeddingSchema.safeParse(new Array(512).fill(0)).success, false);
});

test("attemptSchema requires liveness flag and caps the device label", () => {
  const ok = { embedding: axis(0), livenessPassed: true, deviceLabel: "recepcion" };
  assert.equal(attemptSchema.safeParse(ok).success, true);
  assert.equal(attemptSchema.safeParse({ ...ok, livenessPassed: undefined }).success, false);
  assert.equal(
    attemptSchema.safeParse({ ...ok, deviceLabel: "x".repeat(61) }).success,
    false,
  );
});

test("enrollSchema needs exactly three valid embeddings", () => {
  const ok = {
    clientId: uuid,
    embeddings: [axis(0), axis(1), axis(2)],
    quality: 0.9,
    consentTextVersion: "2026-10-v1",
    modelId: "auraface",
    modelVersion: "v1",
  };
  assert.equal(enrollSchema.safeParse(ok).success, true);
  assert.equal(
    enrollSchema.safeParse({ ...ok, embeddings: [axis(0), axis(1)] }).success,
    false,
  );
  assert.equal(enrollSchema.safeParse({ ...ok, quality: 1.5 }).success, false);
  assert.equal(enrollSchema.safeParse({ ...ok, clientId: "nope" }).success, false);
});

test("settingsSchema keeps the threshold within 0..1", () => {
  assert.equal(
    settingsSchema.safeParse({ matchThreshold: 0.5, livenessRequired: true }).success,
    true,
  );
  assert.equal(
    settingsSchema.safeParse({ matchThreshold: 1.01, livenessRequired: true }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({ matchThreshold: NaN, livenessRequired: true }).success,
    false,
  );
});

test("enrollSchema accepts the non-RFC uuids used by the seeded clients", () => {
  const ok = {
    clientId: "20000000-0000-0000-0000-000000000002",
    embeddings: [axis(0), axis(1), axis(2)],
    quality: 0.9,
    consentTextVersion: "2026-10-v1",
    modelId: "auraface",
    modelVersion: "v1",
  };
  assert.equal(enrollSchema.safeParse(ok).success, true);
});

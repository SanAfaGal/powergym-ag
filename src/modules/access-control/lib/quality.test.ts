import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ABS_PITCH_DEG,
  MAX_ABS_YAW_DEG,
  MIN_BRIGHTNESS,
  MIN_FACE_WIDTH_RATIO,
  captureQualityScore,
  evaluateFrameQuality,
  type FrameObservation,
} from "./quality.ts";

const good: FrameObservation = {
  faceCount: 1,
  faceWidthRatio: 0.4,
  yaw: 0,
  pitch: 0,
  brightness: 0.6,
};

test("a single, close, frontal, bright face is ok", () => {
  assert.deepEqual(evaluateFrameQuality(good), { ok: true });
});

test("no face reports no_face", () => {
  assert.deepEqual(evaluateFrameQuality({ ...good, faceCount: 0 }), {
    ok: false,
    reason: "no_face",
  });
});

test("more than one face reports multiple_faces", () => {
  assert.deepEqual(evaluateFrameQuality({ ...good, faceCount: 2 }), {
    ok: false,
    reason: "multiple_faces",
  });
});

test("face width at the minimum is ok, just below is too_far", () => {
  assert.deepEqual(
    evaluateFrameQuality({ ...good, faceWidthRatio: MIN_FACE_WIDTH_RATIO }),
    { ok: true },
  );
  assert.deepEqual(
    evaluateFrameQuality({ ...good, faceWidthRatio: MIN_FACE_WIDTH_RATIO - 0.01 }),
    { ok: false, reason: "too_far" },
  );
});

test("yaw and pitch at the limit are ok, beyond it are not_frontal", () => {
  assert.deepEqual(evaluateFrameQuality({ ...good, yaw: MAX_ABS_YAW_DEG }), { ok: true });
  assert.deepEqual(evaluateFrameQuality({ ...good, yaw: -MAX_ABS_YAW_DEG - 1 }), {
    ok: false,
    reason: "not_frontal",
  });
  assert.deepEqual(evaluateFrameQuality({ ...good, pitch: MAX_ABS_PITCH_DEG }), { ok: true });
  assert.deepEqual(evaluateFrameQuality({ ...good, pitch: MAX_ABS_PITCH_DEG + 1 }), {
    ok: false,
    reason: "not_frontal",
  });
});

test("brightness at the minimum is ok, just below is too_dark", () => {
  assert.deepEqual(evaluateFrameQuality({ ...good, brightness: MIN_BRIGHTNESS }), { ok: true });
  assert.deepEqual(
    evaluateFrameQuality({ ...good, brightness: MIN_BRIGHTNESS - 0.01 }),
    { ok: false, reason: "too_dark" },
  );
});

test("NaN measurements fail closed instead of passing", () => {
  assert.equal(evaluateFrameQuality({ ...good, yaw: NaN }).ok, false);
  assert.equal(evaluateFrameQuality({ ...good, brightness: NaN }).ok, false);
});

test("captureQualityScore scales with face size and is capped at 1", () => {
  assert.equal(captureQualityScore({ ...good, faceWidthRatio: 0.5 }), 1);
  assert.equal(captureQualityScore({ ...good, faceWidthRatio: 0.25 }), 0.5);
  assert.equal(captureQualityScore({ ...good, faceWidthRatio: 1 }), 1);
});

test("captureQualityScore is 0 for a NaN measurement", () => {
  assert.equal(captureQualityScore({ ...good, faceWidthRatio: NaN }), 0);
});

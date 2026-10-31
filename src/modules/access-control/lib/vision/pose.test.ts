import { test } from "node:test";
import assert from "node:assert/strict";
import { eyesClosed, matrixToYawPitch, mouthOpen, smiling } from "./pose.ts";

const rad = (deg: number) => (deg * Math.PI) / 180;

// 4x4 column-major (MediaPipe's facialTransformationMatrixes layout) for
// R = Rx(pitch) * Ry(yaw).
function columnMajor(yawDeg: number, pitchDeg: number): number[] {
  const cy = Math.cos(rad(yawDeg));
  const sy = Math.sin(rad(yawDeg));
  const cp = Math.cos(rad(pitchDeg));
  const sp = Math.sin(rad(pitchDeg));
  const r = [
    [cy, 0, sy],
    [sp * sy, cp, -sp * cy],
    [-cp * sy, sp, cp * cy],
  ];
  const m = new Array<number>(16).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) m[col * 4 + row] = r[row][col];
  }
  m[15] = 1;
  return m;
}

test("an identity rotation has zero yaw and pitch", () => {
  const { yaw, pitch } = matrixToYawPitch(columnMajor(0, 0));
  assert.ok(Math.abs(yaw) < 1e-9 && Math.abs(pitch) < 1e-9);
});

test("yaw and pitch are recovered in degrees", () => {
  const { yaw, pitch } = matrixToYawPitch(columnMajor(20, -10));
  assert.ok(Math.abs(yaw - 20) < 1e-6, `yaw was ${yaw}`);
  assert.ok(Math.abs(pitch - -10) < 1e-6, `pitch was ${pitch}`);
});

test("a matrix that is too short throws", () => {
  assert.throws(() => matrixToYawPitch([1, 0, 0]), /16/);
});

const shapes = (left: number, right: number) => [
  { categoryName: "eyeBlinkLeft", score: left },
  { categoryName: "eyeBlinkRight", score: right },
  { categoryName: "jawOpen", score: 0.9 },
];

test("eyes are closed only when both blink scores are high", () => {
  assert.equal(eyesClosed(shapes(0.9, 0.8)), true);
  assert.equal(eyesClosed(shapes(0.9, 0.1)), false);
  assert.equal(eyesClosed(shapes(0.1, 0.1)), false);
});

test("missing blink blendshapes count as eyes open", () => {
  assert.equal(eyesClosed([{ categoryName: "jawOpen", score: 1 }]), false);
});

test("the mouth is open when jawOpen is high", () => {
  assert.equal(mouthOpen([{ categoryName: "jawOpen", score: 0.7 }]), true);
  assert.equal(mouthOpen([{ categoryName: "jawOpen", score: 0.2 }]), false);
  assert.equal(mouthOpen([]), false);
});

test("a smile needs both mouth corners raised", () => {
  const sm = (l: number, r: number) => [
    { categoryName: "mouthSmileLeft", score: l },
    { categoryName: "mouthSmileRight", score: r },
  ];
  assert.equal(smiling(sm(0.8, 0.7)), true);
  assert.equal(smiling(sm(0.8, 0.1)), false);
  assert.equal(smiling([]), false);
});

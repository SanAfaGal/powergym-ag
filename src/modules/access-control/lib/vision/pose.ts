export const EYE_CLOSED_SCORE = 0.5;

const DEG = 180 / Math.PI;

// MediaPipe's facialTransformationMatrixes are 4x4 column-major, so
// R[row][col] = m[col * 4 + row]. For R = Rx(pitch) * Ry(yaw):
//   R[0][0] = cos(yaw)    R[0][2] = sin(yaw)
//   R[1][1] = cos(pitch)  R[2][1] = sin(pitch)
// The sign of yaw against the person's left/right has to be confirmed with a
// real face in the spike (docs/access-control/decisions.md).
export function matrixToYawPitch(m: ArrayLike<number>): {
  yaw: number;
  pitch: number;
} {
  if (m.length < 16) throw new Error("expected a 4x4 matrix (16 values)");
  return {
    yaw: Math.atan2(m[8], m[0]) * DEG,
    pitch: Math.atan2(m[6], m[5]) * DEG,
  };
}

export function eyesClosed(
  blendshapes: { categoryName: string; score: number }[],
): boolean {
  const score = (name: string) =>
    blendshapes.find((b) => b.categoryName === name)?.score ?? 0;
  return (
    score("eyeBlinkLeft") > EYE_CLOSED_SCORE &&
    score("eyeBlinkRight") > EYE_CLOSED_SCORE
  );
}

export type ContinuityState = "ok" | "broken";

// Follows the face frame by frame during a liveness challenge, so the gesture
// is tied to ONE continuous face without a second (slow) embedding. It is
// deliberately strict: it breaks on a second face, on ANY frame without the
// face (or without its mesh), when the tracked point jumps between two
// consecutive frames, and when the face size changes abruptly (a different
// face, or a photo swapped in at the same spot).
//
// This is weaker than comparing two embeddings of the same person, and a swap
// faster than one frame is not detectable; the README lists it as a residual
// risk. Points are normalized 0..1 landmark coordinates (the nose tip works
// well); `faceWidth` is the face width as a fraction of the frame.
export function createContinuityTracker(
  options: { maxJump?: number; maxScaleChange?: number } = {},
): {
  push(
    point: { x: number; y: number } | null,
    faceCount: number,
    faceWidth: number,
  ): ContinuityState;
} {
  const maxJump = options.maxJump ?? 0.12;
  const maxScaleChange = options.maxScaleChange ?? 0.3;
  let last: { x: number; y: number } | null = null;
  let lastWidth: number | null = null;
  let broken = false;

  return {
    push(point, faceCount, faceWidth) {
      if (broken) return "broken";
      if (faceCount !== 1 || !point) {
        broken = true;
        return "broken";
      }
      if (last && Math.hypot(point.x - last.x, point.y - last.y) > maxJump) {
        broken = true;
        return "broken";
      }
      if (
        lastWidth !== null &&
        lastWidth > 0 &&
        Math.abs(faceWidth - lastWidth) / lastWidth > maxScaleChange
      ) {
        broken = true;
        return "broken";
      }
      last = point;
      lastWidth = faceWidth;
      return "ok";
    },
  };
}

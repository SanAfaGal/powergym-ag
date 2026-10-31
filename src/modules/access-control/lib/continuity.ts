export type ContinuityState = "ok" | "broken";

// Follows the face frame by frame during a liveness challenge, so the gesture
// is tied to ONE continuous face without a second (slow) embedding: it breaks
// when a second face appears, when the face disappears for too long, or when
// the tracked point jumps across the frame (a different person stepping in).
// Points are normalized 0..1 landmark coordinates (the nose tip works well).
export function createContinuityTracker(
  options: { maxJump?: number; maxLostFrames?: number } = {},
): {
  push(point: { x: number; y: number } | null, faceCount: number): ContinuityState;
} {
  const maxJump = options.maxJump ?? 0.2;
  const maxLostFrames = options.maxLostFrames ?? 6;
  let last: { x: number; y: number } | null = null;
  let lost = 0;
  let broken = false;

  return {
    push(point, faceCount) {
      if (broken) return "broken";
      if (faceCount > 1) {
        broken = true;
        return "broken";
      }
      if (!point) {
        lost += 1;
        if (lost > maxLostFrames) broken = true;
        return broken ? "broken" : "ok";
      }
      lost = 0;
      if (last && Math.hypot(point.x - last.x, point.y - last.y) > maxJump) {
        broken = true;
        return "broken";
      }
      last = point;
      return "ok";
    },
  };
}

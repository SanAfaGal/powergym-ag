export const MIN_FACE_WIDTH_RATIO = 0.25;
export const MAX_ABS_YAW_DEG = 20;
export const MAX_ABS_PITCH_DEG = 20;
export const MIN_BRIGHTNESS = 0.25;

export type FrameObservation = {
  faceCount: number;
  // face bounding-box width / frame width
  faceWidthRatio: number;
  yaw: number;
  pitch: number;
  // mean luminance of the face region, 0..1
  brightness: number;
};

export type QualityVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_face"
        | "multiple_faces"
        | "too_far"
        | "not_frontal"
        | "too_dark";
    };

// Every threshold check is written as "!(value is within limits)" so a NaN
// measurement fails closed instead of slipping through a `<` comparison.
export function evaluateFrameQuality(o: FrameObservation): QualityVerdict {
  if (o.faceCount < 1) return { ok: false, reason: "no_face" };
  if (o.faceCount > 1) return { ok: false, reason: "multiple_faces" };
  if (!(o.faceWidthRatio >= MIN_FACE_WIDTH_RATIO)) {
    return { ok: false, reason: "too_far" };
  }
  if (
    !(Math.abs(o.yaw) <= MAX_ABS_YAW_DEG) ||
    !(Math.abs(o.pitch) <= MAX_ABS_PITCH_DEG)
  ) {
    return { ok: false, reason: "not_frontal" };
  }
  if (!(o.brightness >= MIN_BRIGHTNESS)) {
    return { ok: false, reason: "too_dark" };
  }
  return { ok: true };
}

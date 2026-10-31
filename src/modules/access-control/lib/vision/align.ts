export type Point = [number, number];

// Canvas `setTransform(a, b, c, d, e, f)` order: x' = a*x + c*y + e,
// y' = b*x + d*y + f.
export type SimilarityTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

// Where ArcFace-family models expect the left eye, right eye, nose tip and
// mouth corners inside the 112x112 aligned crop (InsightFace's standard
// template). "Left" and "right" are in image space, not the subject's.
export const ARCFACE_TEMPLATE: Point[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

// Least-squares similarity transform (rotation + uniform scale +
// translation, no reflection) mapping `src` onto `dst`.
export function estimateSimilarityTransform(
  src: Point[],
  dst: Point[],
): SimilarityTransform {
  if (src.length !== dst.length) {
    throw new Error("src and dst need the same number of points");
  }
  if (src.length < 2) throw new Error("need at least 2 points");

  const n = src.length;
  const mean = (pts: Point[], i: 0 | 1) =>
    pts.reduce((s, p) => s + p[i], 0) / n;
  const msx = mean(src, 0);
  const msy = mean(src, 1);
  const mdx = mean(dst, 0);
  const mdy = mean(dst, 1);

  let denom = 0;
  let dot = 0;
  let cross = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - msx;
    const sy = src[i][1] - msy;
    const dx = dst[i][0] - mdx;
    const dy = dst[i][1] - mdy;
    denom += sx * sx + sy * sy;
    dot += sx * dx + sy * dy;
    cross += sx * dy - sy * dx;
  }
  if (!(denom > 0)) throw new Error("degenerate source points");

  // dst = [[p, -q], [q, p]] * src + t, with p = s*cos(theta), q = s*sin(theta)
  const p = dot / denom;
  const q = cross / denom;
  return {
    a: p,
    b: q,
    c: -q,
    d: p,
    e: mdx - (p * msx - q * msy),
    f: mdy - (q * msx + p * msy),
  };
}

export function applyTransform(t: SimilarityTransform, [x, y]: Point): Point {
  return [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
}

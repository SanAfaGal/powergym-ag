export type MeshLandmark = { x: number; y: number };
export type MeshConnection = { start: number; end: number };
export type MeshContext = Pick<
  CanvasRenderingContext2D,
  "clearRect" | "beginPath" | "moveTo" | "lineTo" | "stroke"
> & {
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
};

// Draws the face mesh (landmarks are normalized 0..1) over the camera
// preview. With no face it just clears the canvas.
export function drawFaceMesh(
  ctx: MeshContext,
  landmarks: MeshLandmark[] | null,
  connections: MeshConnection[],
  width: number,
  height: number,
  color: string,
): void {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const { start, end } of connections) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
  }
  ctx.stroke();
}

export function faceBounds(
  landmarks: MeshLandmark[],
): { x: number; y: number; width: number; height: number } | null {
  if (landmarks.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of landmarks) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Four corner brackets around the face. It does NOT clear the canvas, so it is
// drawn after drawFaceMesh, on top of the mesh.
export function drawFaceFrame(
  ctx: MeshContext,
  landmarks: MeshLandmark[] | null,
  width: number,
  height: number,
  color: string,
): void {
  const box = landmarks ? faceBounds(landmarks) : null;
  if (!box) return;

  const x1 = box.x * width;
  const y1 = box.y * height;
  const x2 = (box.x + box.width) * width;
  const y2 = (box.y + box.height) * height;
  const arm = Math.min(x2 - x1, y2 - y1) * 0.22;

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  // top-left, top-right, bottom-right, bottom-left
  ctx.moveTo(x1, y1 + arm);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + arm, y1);
  ctx.moveTo(x2 - arm, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y1 + arm);
  ctx.moveTo(x2, y2 - arm);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - arm, y2);
  ctx.moveTo(x1 + arm, y2);
  ctx.lineTo(x1, y2);
  ctx.lineTo(x1, y2 - arm);
  ctx.stroke();
}

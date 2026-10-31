export type MeshLandmark = { x: number; y: number };
export type MeshConnection = { start: number; end: number };
export type MeshContext = Pick<
  CanvasRenderingContext2D,
  "clearRect" | "beginPath" | "moveTo" | "lineTo" | "stroke"
> & { strokeStyle: string | CanvasGradient | CanvasPattern; lineWidth: number };

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

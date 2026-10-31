import { portraitCrop } from "../portraitCrop.ts";
import { faceBounds, type MeshLandmark } from "./drawMesh.ts";

// Takes a portrait of the current video frame as a small JPEG: a 4:5 crop
// centered on the face, with room around it (see portraitCrop), at most
// 480x600 px (about 50 KB). Without a mesh it falls back to the whole frame.
// The still is flipped sideways, like the mirrored preview. Returns null if
// the browser cannot produce it; the caller treats the photo as optional.
const MAX_WIDTH = 480;
const MAX_HEIGHT = 600;
const MAX_SIDE = 640;
const JPEG_QUALITY = 0.88;

export function captureJpeg(
  video: HTMLVideoElement,
  mesh: MeshLandmark[] | null = null,
): Promise<Blob | null> {
  const { videoWidth: w, videoHeight: h } = video;
  if (!w || !h) return Promise.resolve(null);

  const bounds = mesh ? faceBounds(mesh) : null;
  const crop = bounds
    ? portraitCrop(bounds, w, h)
    : { sx: 0, sy: 0, sw: w, sh: h };
  const scale = bounds
    ? Math.min(1, MAX_WIDTH / crop.sw, MAX_HEIGHT / crop.sh)
    : Math.min(1, MAX_SIDE / Math.max(w, h));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.sw * scale);
  canvas.height = Math.round(crop.sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  // Flipped sideways on purpose: the preview the person watches is a mirror
  // (CSS -scale-x-100), and the photo should look like what they saw.
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(
    video,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY),
  );
}

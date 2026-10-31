// RGBA pixels -> the float32 CHW tensor ArcFace-family models take:
// RGB order, (v - 127.5) / 127.5, so values land in [-1, 1].
export function imageDataToTensor(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const pixels = width * height;
  if (rgba.length !== pixels * 4) {
    throw new Error("buffer size does not match width x height");
  }
  const out = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    out[i] = (rgba[i * 4] - 127.5) / 127.5;
    out[pixels + i] = (rgba[i * 4 + 1] - 127.5) / 127.5;
    out[2 * pixels + i] = (rgba[i * 4 + 2] - 127.5) / 127.5;
  }
  return out;
}

// Mean Rec. 601 luma over the buffer, 0..1.
export function meanBrightness(rgba: Uint8ClampedArray | Uint8Array): number {
  const pixels = rgba.length / 4;
  if (pixels === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    sum +=
      0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return sum / pixels / 255;
}

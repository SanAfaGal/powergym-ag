export type NormalizedBounds = { x: number; y: number; width: number; height: number };
export type CropRect = { sx: number; sy: number; sw: number; sh: number };

const RATIO = 4 / 5; // width / height

// The face mesh stops at the forehead and the chin, so the hair is outside its
// box. The head is taken as that box plus this much of the face height above
// the forehead and below the chin.
const HEAD_ABOVE = 0.3;
const HEAD_BELOW = 0.05;

// How much bigger than the face width / the head height the crop is wanted:
// the face takes about 45% of the width, the head about 60% of the height, so
// there is air all around.
const WIDTH_PER_FACE = 2.2;
const HEIGHT_PER_HEAD = 1.6;
// The crop is never tighter than this around the head, however close to an
// edge it is.
const MIN_PER_FACE_WIDTH = 1.3;
const MIN_PER_HEAD_HEIGHT = 1.15;

// The 4:5 portrait rectangle (in video pixels) to cut out for the registration
// photo: the whole head, centered on both axes, with room around it. To keep
// it centered the crop is made only as big as the room around the head allows
// (the smaller distance to an edge, on each axis). If the head is so close to
// an edge that this would cut into it, the crop keeps a minimum margin and is
// shifted inside the frame instead, so it never reaches outside the video.
export function portraitCrop(
  face: NormalizedBounds,
  videoWidth: number,
  videoHeight: number,
): CropRect {
  const faceW = face.width * videoWidth;
  const faceH = face.height * videoHeight;
  const headH = faceH * (1 + HEAD_ABOVE + HEAD_BELOW);
  const centerX = (face.x + face.width / 2) * videoWidth;
  const headTop = face.y * videoHeight - faceH * HEAD_ABOVE;
  const centerY = headTop + headH / 2;

  // biggest crop that fits in the video at all
  const fits = Math.min(videoWidth, videoHeight * RATIO);
  // biggest crop that keeps the head exactly in the middle
  const centered = Math.min(
    2 * Math.min(centerX, videoWidth - centerX),
    2 * Math.min(centerY, videoHeight - centerY) * RATIO,
  );
  const wanted = Math.max(faceW * WIDTH_PER_FACE, headH * HEIGHT_PER_HEAD * RATIO);
  const smallest = Math.min(
    Math.max(faceW * MIN_PER_FACE_WIDTH, headH * MIN_PER_HEAD_HEIGHT * RATIO),
    fits,
  );

  const sw = Math.max(Math.min(wanted, fits, centered), smallest);
  const sh = sw / RATIO;

  return {
    sx: Math.min(Math.max(centerX - sw / 2, 0), videoWidth - sw),
    sy: Math.min(Math.max(centerY - sh / 2, 0), videoHeight - sh),
    sw,
    sh,
  };
}

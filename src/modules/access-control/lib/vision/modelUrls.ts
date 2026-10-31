// Models are served from /models by default. Set NEXT_PUBLIC_MODELS_BASE_URL
// to host the 260 MB file elsewhere (a CDN or object storage with CORS
// enabled) so it is not bundled into every deploy.
const base = (process.env.NEXT_PUBLIC_MODELS_BASE_URL ?? "/models").replace(/\/+$/, "");

export const EMBEDDER_MODEL_URL = `${base}/glintr100.onnx`;
export const LANDMARKER_MODEL_URL = `${base}/face_landmarker.task`;

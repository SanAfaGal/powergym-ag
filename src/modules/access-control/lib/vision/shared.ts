import { createSharedResource } from "../sharedResource";
import { createEmbedder, type Embedder } from "./embedder";
import { createFaceDetector, type FaceDetector } from "./faceDetector";

// The detector and the recognition model are heavy (the model is ~260 MB and
// takes seconds to prepare), so they are loaded once per tab and kept across
// screens: moving between modules and coming back does not reload them. They
// are released only after this long without anyone using them, so a weak
// device is not left holding that memory all day. Raise it (or use Infinity)
// for a dedicated kiosk.
export const IDLE_DISPOSE_MS = 30 * 60 * 1000;

export const sharedDetector = createSharedResource<FaceDetector>({
  create: createFaceDetector,
  dispose: (detector) => detector.close(),
  idleMs: IDLE_DISPOSE_MS,
});

export const sharedEmbedder = createSharedResource<Embedder>({
  create: () => createEmbedder(),
  dispose: (embedder) => embedder.close(),
  idleMs: IDLE_DISPOSE_MS,
});

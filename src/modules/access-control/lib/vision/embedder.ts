import { l2Normalize } from "../embedding";
import {
  ARCFACE_TEMPLATE,
  estimateSimilarityTransform,
} from "./align";
import type { FrameAnalysis } from "./faceDetector";
import { imageDataToTensor } from "./preprocess";
import { EMBEDDER_MODEL_URL } from "./modelUrls";

const SIZE = 112;

export type Embedder = {
  // Aligns the face with its 5 landmarks and returns a unit-length embedding.
  embed(video: HTMLVideoElement, analysis: FrameAnalysis): Promise<number[]>;
  // Runs the model on an already aligned, preprocessed 1x3x112x112 tensor.
  embedTensor(data: Float32Array): Promise<number[]>;
  // Where the model runs: the GPU (fast) or the CPU (slower).
  backend: "webgpu" | "wasm";
  close(): Promise<void>;
};

// The ~260 MB model file is kept in the browser's Cache Storage, so a page
// reload reads it from disk (about half a second) instead of downloading it
// again. (localStorage cannot hold it: ~5 MB, text only.) It is handed to ONNX
// Runtime as a blob: URL rather than as bytes: passing 250 MB of bytes makes it
// copy them between threads and was several times slower than a URL. Bump the
// cache name if the model file changes. Cache Storage only exists in secure
// contexts and can refuse a write when the quota is short; in both cases the
// model is simply fetched from its URL as before.
const MODEL_CACHE = "powergym-models-v1";

async function loadModelSource(
  url: string,
): Promise<{ url: string; revoke: () => void }> {
  const plain = { url, revoke: () => {} };
  if (typeof caches === "undefined") return plain;
  try {
    const cache = await caches.open(MODEL_CACHE);
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) return plain;
      try {
        await cache.put(url, response.clone());
      } catch {
        // quota exceeded: still use this download, just do not keep it
      }
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    return { url: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  } catch {
    return plain;
  }
}

type Ort = typeof import("onnxruntime-web/wasm");
type Session = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>;

function openSession(ort: Ort, url: string, provider: string[]) {
  return ort.InferenceSession.create(url, {
    executionProviders: provider,
    graphOptimizationLevel: "all",
  });
}

// Tries the GPU first (WebGPU): the ResNet100 model takes ~1.5-2.5 s per face
// on a CPU/WASM and a fraction of that on a GPU. Without WebGPU, or if the
// session fails to start, it falls back to the CPU in a proxy worker.
// "gpu" in navigator is not enough: without a real adapter (headless, old
// drivers, blocklisted GPU) creating the session fails only AFTER the 260 MB
// model was loaded into the WebGPU runtime, and the CPU attempt then starts
// from scratch -- about twice the wait. Ask for an adapter first.
async function hasWebGpuAdapter(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return Boolean(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function openBest(
  url: string,
): Promise<{ ort: Ort; session: Session; backend: "webgpu" | "wasm" }> {
  if (await hasWebGpuAdapter()) {
    try {
      const gpu = (await import("onnxruntime-web/webgpu")) as unknown as Ort;
      gpu.env.wasm.wasmPaths = "/ort/";
      gpu.env.wasm.numThreads = 1;
      const session = await openSession(gpu, url, ["webgpu"]);
      return { ort: gpu, session, backend: "webgpu" };
    } catch {
      // fall through to the CPU
    }
  }

  // Loaded on demand: evaluating onnxruntime-web at module level breaks SSR
  // of any client component that imports this file, and keeps the runtime
  // out of every page that does not use the camera.
  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.wasmPaths = "/ort/";
  ort.env.wasm.numThreads = 1;
  // Measured: without this the UI is frozen for the whole inference; with it
  // the longest main-thread stall is ~30 ms. It must be set before the first
  // session is created (ONNX Runtime initializes once per page).
  ort.env.wasm.proxy = true;
  const session = await openSession(ort, url, ["wasm"]);
  return { ort, session, backend: "wasm" };
}

// ArcFace-family model (AuraFace glintr100) on ONNX Runtime Web.
async function createSession(modelUrl: string) {
  const model = await loadModelSource(modelUrl);
  try {
    return await openBest(model.url);
  } finally {
    // the session already holds the model: the blob URL is no longer needed
    model.revoke();
  }
}

export async function createEmbedder(
  modelUrl = EMBEDDER_MODEL_URL,
): Promise<Embedder> {
  const { ort, session, backend } = await createSession(modelUrl);
  const inputName = session.inputNames[0];

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d canvas is not available");

  async function embedTensor(data: Float32Array): Promise<number[]> {
    const input = new ort.Tensor("float32", data, [1, 3, SIZE, SIZE]);
    const output = await session.run({ [inputName]: input });
    const first = output[session.outputNames[0]];
    return l2Normalize(Array.from(first.data as Float32Array));
  }

  return {
    backend,
    embedTensor,
    async embed(video, analysis) {
      if (!analysis.landmarks5) throw new Error("no aligned face");
      const t = estimateSimilarityTransform(analysis.landmarks5, ARCFACE_TEMPLATE);
      ctx!.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
      ctx!.drawImage(video, 0, 0);
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      const { data } = ctx!.getImageData(0, 0, SIZE, SIZE);
      return embedTensor(imageDataToTensor(data, SIZE, SIZE));
    },
    async close() {
      await session.release();
    },
  };
}

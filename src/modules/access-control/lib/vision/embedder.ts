import { l2Normalize } from "../embedding";
import {
  ARCFACE_TEMPLATE,
  estimateSimilarityTransform,
} from "./align";
import type { FrameAnalysis } from "./faceDetector";
import { imageDataToTensor } from "./preprocess";

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

type Ort = typeof import("onnxruntime-web/wasm");
type Session = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>;

// Tries the GPU first (WebGPU): the ResNet100 model takes ~1.5-2.5 s per face
// on a CPU/WASM and a fraction of that on a GPU. Without WebGPU, or if the
// session fails to start, it falls back to the CPU in a proxy worker.
async function createSession(
  modelUrl: string,
): Promise<{ ort: Ort; session: Session; backend: "webgpu" | "wasm" }> {
  if ("gpu" in navigator) {
    try {
      const gpu = (await import("onnxruntime-web/webgpu")) as unknown as Ort;
      gpu.env.wasm.wasmPaths = "/ort/";
      gpu.env.wasm.numThreads = 1;
      const session = await gpu.InferenceSession.create(modelUrl, {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "all",
      });
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
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  return { ort, session, backend: "wasm" };
}

// ArcFace-family model (AuraFace glintr100) on ONNX Runtime Web.
export async function createEmbedder(
  modelUrl = "/models/glintr100.onnx",
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

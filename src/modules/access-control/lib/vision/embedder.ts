import * as ort from "onnxruntime-web/wasm";
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
  close(): Promise<void>;
};

// ArcFace-family model (AuraFace glintr100) on ONNX Runtime Web. Single
// WASM thread: multithreading needs cross-origin isolation headers, and the
// embedding only runs when a face is stable, not on every frame.
export async function createEmbedder(
  modelUrl = "/models/glintr100.onnx",
): Promise<Embedder> {
  ort.env.wasm.wasmPaths = "/ort/";
  ort.env.wasm.numThreads = 1;

  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
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

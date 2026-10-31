import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FrameObservation } from "../quality";
import type { LivenessSignal } from "../liveness";
import type { Point } from "./align";
import { eyesClosed, matrixToYawPitch } from "./pose";
import { meanBrightness } from "./preprocess";

export type FrameAnalysis = {
  observation: FrameObservation;
  signal: LivenessSignal;
  // Left eye, right eye, nose tip, left and right mouth corner, in video
  // pixels and in image space (left = smaller x). Null when there is not
  // exactly one face to align.
  landmarks5: Point[] | null;
};

export type FaceDetector = {
  detect(video: HTMLVideoElement, nowMs: number): FrameAnalysis;
  close(): void;
};

// FaceMesh landmark indices: iris centers (468, 473), nose tip (1), mouth
// corners (61, 291).
const IRIS_A = 468;
const IRIS_B = 473;
const NOSE = 1;
const MOUTH_A = 61;
const MOUTH_B = 291;

const SAMPLE_W = 64;
const SAMPLE_H = 48;

const EMPTY_SIGNAL: LivenessSignal = { eyesClosed: false, yaw: 0 };

// MediaPipe's FaceLandmarker only DETECTS and measures (landmarks, head
// pose, blendshapes). It does not identify anyone; that is the embedder.
export async function createFaceDetector(): Promise<FaceDetector> {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const options = {
    runningMode: "VIDEO" as const,
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  };

  let landmarker: FaceLandmarker;
  try {
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "GPU",
      },
    });
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "CPU",
      },
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  return {
    detect(video, nowMs) {
      const result = landmarker.detectForVideo(video, nowMs);
      const faceCount = result.faceLandmarks.length;
      if (faceCount !== 1) {
        return {
          observation: {
            faceCount,
            faceWidthRatio: 0,
            yaw: 0,
            pitch: 0,
            brightness: 0,
          },
          signal: EMPTY_SIGNAL,
          landmarks5: null,
        };
      }

      const lm = result.faceLandmarks[0];
      const xs = lm.map((p) => p.x);
      const ys = lm.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      let brightness = 0;
      if (ctx) {
        ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        const x = Math.max(0, Math.floor(minX * SAMPLE_W));
        const y = Math.max(0, Math.floor(minY * SAMPLE_H));
        const w = Math.max(1, Math.min(SAMPLE_W - x, Math.ceil((maxX - minX) * SAMPLE_W)));
        const h = Math.max(1, Math.min(SAMPLE_H - y, Math.ceil((maxY - minY) * SAMPLE_H)));
        brightness = meanBrightness(ctx.getImageData(x, y, w, h).data);
      }

      const matrix = result.facialTransformationMatrixes[0]?.data;
      const { yaw, pitch } = matrix
        ? matrixToYawPitch(matrix)
        : { yaw: 0, pitch: 0 };
      const blendshapes = result.faceBlendshapes[0]?.categories ?? [];

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const pt = (i: number): Point => [lm[i].x * vw, lm[i].y * vh];
      const [eyeL, eyeR] = [pt(IRIS_A), pt(IRIS_B)].sort((a, b) => a[0] - b[0]);
      const [mouthL, mouthR] = [pt(MOUTH_A), pt(MOUTH_B)].sort((a, b) => a[0] - b[0]);

      return {
        observation: {
          faceCount: 1,
          faceWidthRatio: maxX - minX,
          yaw,
          pitch,
          brightness,
        },
        signal: { eyesClosed: eyesClosed(blendshapes), yaw },
        landmarks5: [eyeL, eyeR, pt(NOSE), mouthL, mouthR],
      };
    },
    close() {
      landmarker.close();
    },
  };
}

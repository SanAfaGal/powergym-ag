"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraError, startCamera } from "./lib/vision/camera";
import { createFaceDetector, type FaceDetector } from "./lib/vision/faceDetector";
import { createEmbedder, type Embedder } from "./lib/vision/embedder";
import type { CameraSessionError } from "./lib/uiMessages";

export type CameraSessionStatus =
  | "off"
  | "requesting"
  | "loading"
  | "ready"
  | "error";

// Owns the camera stream, the face detector and the embedder for one screen,
// and releases all three on stop() or unmount (a phone kills a tab that
// holds on to its memory). A run id guards against stop()/unmount landing
// while start() is still awaiting.
export function useCameraSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detector = useRef<FaceDetector | null>(null);
  const embedder = useRef<Embedder | null>(null);
  const camera = useRef<{ stop(): void } | null>(null);
  const run = useRef(0);
  const [status, setStatus] = useState<CameraSessionStatus>("off");
  const [error, setError] = useState<CameraSessionError | null>(null);

  const release = useCallback(() => {
    camera.current?.stop();
    camera.current = null;
    detector.current?.close();
    detector.current = null;
    void embedder.current?.close();
    embedder.current = null;
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    release();
    setError(null);
    setStatus("off");
  }, [release]);

  const start = useCallback(async () => {
    const id = ++run.current;
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setStatus("requesting");

    try {
      const cam = await startCamera(video);
      if (id !== run.current) return cam.stop();
      camera.current = cam;
    } catch (e) {
      if (id !== run.current) return;
      setError(e instanceof CameraError ? e.kind : "unsupported");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const [d, m] = await Promise.all([createFaceDetector(), createEmbedder()]);
      if (id !== run.current) {
        d.close();
        void m.close();
        return;
      }
      detector.current = d;
      embedder.current = m;
      setStatus("ready");
    } catch {
      if (id !== run.current) return;
      release();
      setError("model");
      setStatus("error");
    }
  }, [release]);

  useEffect(() => {
    return () => {
      run.current += 1;
      release();
    };
  }, [release]);

  return { videoRef, detector, embedder, status, error, start, stop };
}

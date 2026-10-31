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
//
// "ready" means camera + detector: the preview and mesh work right away. The
// embedder (the 260 MB model) keeps loading in the background and is awaited
// via getEmbedder() only when a capture actually needs it.
export function useCameraSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detector = useRef<FaceDetector | null>(null);
  const embedderPromise = useRef<Promise<Embedder> | null>(null);
  const camera = useRef<{ stop(): void } | null>(null);
  const run = useRef(0);
  const [status, setStatus] = useState<CameraSessionStatus>("off");
  const [error, setError] = useState<CameraSessionError | null>(null);

  const release = useCallback(() => {
    camera.current?.stop();
    camera.current = null;
    detector.current?.close();
    detector.current = null;
    // Also covers a model that is still loading: it closes as soon as it lands.
    void embedderPromise.current?.then((m) => m.close()).catch(() => {});
    embedderPromise.current = null;
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    release();
    setError(null);
    setStatus("off");
  }, [release]);

  const fail = useCallback(
    (id: number, kind: CameraSessionError) => {
      if (id !== run.current) return;
      release();
      setError(kind);
      setStatus("error");
    },
    [release],
  );

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
    // The big model starts loading now, in parallel, but does not gate ready.
    const embedding = createEmbedder();
    embedderPromise.current = embedding;
    embedding.catch(() => fail(id, "model"));

    try {
      const d = await createFaceDetector();
      if (id !== run.current) return d.close();
      detector.current = d;
      setStatus("ready");
    } catch {
      fail(id, "model");
    }
  }, [fail]);

  // Resolves when the model has loaded; rejects if it failed to load.
  const getEmbedder = useCallback((): Promise<Embedder> => {
    const p = embedderPromise.current;
    return p ?? Promise.reject(new Error("camera session not started"));
  }, []);

  useEffect(() => {
    return () => {
      run.current += 1;
      release();
    };
  }, [release]);

  return { videoRef, detector, getEmbedder, status, error, start, stop };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraError, startCamera } from "./lib/vision/camera";
import type { FaceDetector } from "./lib/vision/faceDetector";
import type { Embedder } from "./lib/vision/embedder";
import { sharedDetector, sharedEmbedder } from "./lib/vision/shared";
import type { CameraSessionError } from "./lib/uiMessages";

export type CameraSessionStatus =
  | "off"
  | "requesting"
  | "loading"
  | "ready"
  | "error";

// Owns the camera stream for one screen and lends it the shared face detector
// and embedder. The camera is always released on stop() or unmount (privacy,
// battery, and a phone kills a tab that holds on to its memory). The detector
// and the model are NOT closed here: they are shared across screens and
// disposed only after a long idle time (see lib/vision/shared.ts), so coming
// back to the kiosk does not reload them. A run id guards against stop() or
// unmount landing while start() is still awaiting.
//
// "ready" means camera + detector: the preview and mesh work right away. The
// embedder (the 260 MB model) keeps loading in the background and is awaited
// via getEmbedder() only when a capture actually needs it.
export function useCameraSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detector = useRef<FaceDetector | null>(null);
  const embedderPromise = useRef<Promise<Embedder> | null>(null);
  const embedderLoaded = useRef(false);
  const camera = useRef<{ stop(): void } | null>(null);
  // true between acquiring the shared detector/embedder and releasing them
  const holdingVision = useRef(false);
  const run = useRef(0);
  const [status, setStatus] = useState<CameraSessionStatus>("off");
  const [error, setError] = useState<CameraSessionError | null>(null);

  const release = useCallback(() => {
    camera.current?.stop();
    camera.current = null;
    detector.current = null;
    embedderPromise.current = null;
    embedderLoaded.current = false;
    if (holdingVision.current) {
      holdingVision.current = false;
      sharedDetector.release();
      sharedEmbedder.release();
    }
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

    // Already loaded by an earlier visit? Then both resolve at once.
    setStatus("loading");
    holdingVision.current = true;
    const embedding = sharedEmbedder.acquire();
    const detecting = sharedDetector.acquire();
    embedderPromise.current = embedding;
    embedding.then(
      () => {
        if (id === run.current) embedderLoaded.current = true;
      },
      () => fail(id, "model"),
    );

    try {
      const d = await detecting;
      // superseded: stop()/unmount already released what this run acquired
      if (id !== run.current) return;
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

  // True once the model has loaded, so a caller can avoid starting work that
  // would sit waiting for it (and embed a frame that is no longer current).
  const isEmbedderReady = useCallback(() => embedderLoaded.current, []);

  useEffect(() => {
    return () => {
      run.current += 1;
      release();
    };
  }, [release]);

  return {
    videoRef,
    detector,
    getEmbedder,
    isEmbedderReady,
    status,
    error,
    start,
    stop,
  };
}

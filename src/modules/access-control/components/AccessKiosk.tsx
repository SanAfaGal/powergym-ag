"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, ScanFaceIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attemptAccess } from "../actions";
import { SimulatedBarrier } from "../lib/barrier/SimulatedBarrier";
import { pickChallenge } from "../lib/challengePicker";
import { createContinuityTracker } from "../lib/continuity";
import {
  initialKioskState,
  kioskReducer,
  type FaceHint,
  type KioskEvent,
  type KioskState,
} from "../lib/kioskMachine";
import { bannerFor, resultViewFor, type Tone } from "../lib/kioskView";
import { createLivenessSession, type LivenessChallenge } from "../lib/liveness";
import { evaluateFrameQuality } from "../lib/quality";
import { createStabilityTracker } from "../lib/stability";
import { cameraErrorMessage } from "../lib/uiMessages";
import { drawFaceFrame, drawFaceMesh } from "../lib/vision/drawMesh";
import type { FrameAnalysis } from "../lib/vision/faceDetector";
import { useCameraSession } from "../useCameraSession";
import { AccessResultPanel } from "./AccessResultPanel";
import { KioskStageOverlay } from "./KioskStageOverlay";

// Fast while someone is in front of the camera (smooth mesh, ~0.4 s of
// steadiness at STABLE_FRAMES), slow while the frame is empty.
const ACTIVE_INTERVAL_MS = 120;
const IDLE_INTERVAL_MS = 400;
const STABLE_FRAMES = 3;
const CHALLENGE_TIMEOUT_MS = 6000;
const MAX_FINAL_WAIT_FRAMES = 20;
// How long the capture flash stays visible (the frame itself is read at once).
const CAPTURE_FLASH_MS = 300;
// FaceMesh landmark index of the nose tip (normalized 0..1 in analysis.mesh).
const NOSE_TIP = 1;
const MESH_OK = "rgba(74, 222, 128, 0.55)";
const MESH_WARN = "rgba(251, 191, 36, 0.55)";
const FRAME_OK = "rgb(74, 222, 128)";
const FRAME_WARN = "rgb(251, 191, 36)";

// A pool that is somehow empty falls back to blink rather than crashing the
// kiosk (the database already refuses an empty pool while liveness is on).
const FALLBACK_POOL: LivenessChallenge[] = ["blink"];

// Solid-ish backgrounds so the instruction stays readable over any camera
// image, in a bright gym or a dark room.
const TONE_CLASS: Record<Tone, string> = {
  info: "bg-background/85 text-foreground",
  warn: "bg-warning/90 text-warning-foreground",
  ok: "bg-success/90 text-success-foreground",
  error: "bg-destructive/90 text-white",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function deviceLabel() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Celular"
    : "Computador";
}

// How long each outcome stays on screen before the kiosk goes back to waiting.
function displayMs(state: KioskState): number | null {
  switch (state.name) {
    case "ACCESS_GRANTED":
    case "ACCESS_DENIED":
      return 5000;
    case "FACE_NOT_RECOGNIZED":
      return 3500;
    case "ERROR":
      return state.recoverable ? 4000 : null;
    default:
      return null;
  }
}

// The single source of truth for the flow. The ref lets the camera loop read
// the current state synchronously; the state drives rendering.
function useKioskMachine() {
  const stateRef = useRef<KioskState>(initialKioskState);
  const [state, setState] = useState<KioskState>(initialKioskState);
  const send = useCallback((event: KioskEvent) => {
    const next = kioskReducer(stateRef.current, event);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);
  return { state, stateRef, send };
}

export function AccessKiosk({
  livenessRequired,
  challenges,
}: {
  livenessRequired: boolean;
  // Pool the admin enabled in the access settings; one is drawn per attempt.
  challenges: LivenessChallenge[];
}) {
  const session = useCameraSession();
  const { videoRef, detector, getEmbedder, isEmbedderReady } = session;
  const { state, stateRef, send } = useKioskMachine();

  // No barrier graphic on screen (the access message is enough), but the
  // controller stays behind the BarrierController port, so a real device can
  // replace SimulatedBarrier later without touching the validation.
  const [barrier] = useState(() => new SimulatedBarrier());
  // Where the recognition model runs, shown next to the camera status so a
  // slow kiosk can be diagnosed at a glance ("CPU" is much slower than "GPU").
  const [backend, setBackend] = useState<"webgpu" | "wasm" | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stability = useRef(createStabilityTracker(STABLE_FRAMES));
  // Resources of the current attempt (not flow state: that is the machine's).
  const liveness = useRef<ReturnType<typeof createLivenessSession> | null>(null);
  const continuity = useRef<ReturnType<typeof createContinuityTracker> | null>(null);
  const finalWait = useRef(0);
  const lastChallenge = useRef<LivenessChallenge | null>(null);

  // The camera session feeds the machine.
  useEffect(() => {
    if (session.status === "ready") send({ type: "CAMERA_READY" });
    else if (session.status === "error" && session.error) {
      send({
        type: "FAILED",
        message: cameraErrorMessage(session.error),
        recoverable: false,
      });
    } else send({ type: "CAMERA_STOPPED" });
  }, [session.status, session.error, send]);

  // Back to waiting: drop whatever the previous attempt left behind.
  useEffect(() => {
    if (state.name === "DETECTING" || state.name === "IDLE") {
      liveness.current = null;
      continuity.current = null;
      finalWait.current = 0;
      stability.current.reset();
    }
  }, [state.name]);

  // Results and errors go away by themselves after a few seconds.
  useEffect(() => {
    const ms = displayMs(state);
    if (!ms) return;
    const timer = setTimeout(
      () => send({ type: "DISPLAY_DONE", now: performance.now() }),
      ms,
    );
    return () => clearTimeout(timer);
  }, [state, send]);

  useEffect(() => {
    if (session.status !== "ready") return;
    let cancelled = false;
    getEmbedder()
      .then((m) => {
        if (!cancelled) setBackend(m.backend);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session.status, getEmbedder]);

  // Keep the screen awake while the kiosk is running (best effort).
  useEffect(() => {
    if (session.status !== "ready") return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, [session.status]);

  // The whole attempt, stage by stage: capture the frame, build the face
  // embedding on this device, then one server call compares it and checks the
  // membership. Each stage is reported to the machine as it really happens.
  // The frame is read immediately (embed draws it synchronously); the flash is
  // only decoration. No image is kept or uploaded: only the embedding leaves.
  const runAttempt = useCallback(
    async (
      video: HTMLVideoElement,
      analysis: FrameAnalysis,
      livenessPassed: boolean,
    ) => {
      try {
        const embedder = await getEmbedder();
        const pending = embedder.embed(video, analysis);
        pending.catch(() => {});
        await sleep(CAPTURE_FLASH_MS);
        send({ type: "CAPTURED" });
        const embedding = await pending;
        send({ type: "EMBEDDED" });

        const outcome = await attemptAccess({
          embedding,
          livenessPassed,
          deviceLabel: deviceLabel(),
        });
        if ("error" in outcome) {
          send({ type: "FAILED", message: outcome.error });
          return;
        }
        send({ type: "RESULT", result: outcome.result });
        if (outcome.result.decision === "granted") void barrier.open();
      } catch {
        send({
          type: "FAILED",
          message: "No se pudo procesar el rostro, intentá de nuevo",
        });
      }
    },
    [getEmbedder, send, barrier],
  );

  // One detection step; returns how long to wait before the next one.
  const step = useCallback((): number => {
    const video = videoRef.current;
    const live = detector.current;
    if (!video || !live) return IDLE_INTERVAL_MS;

    const now = performance.now();
    const analysis = live.detect(video, now);
    const quality = evaluateFrameQuality(analysis.observation);
    const hint: FaceHint | "no_face" = quality.ok ? "ok" : quality.reason;
    const faceCount = analysis.observation.faceCount;
    const next = faceCount > 0 ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      drawFaceMesh(
        ctx,
        analysis.mesh,
        live.connections,
        canvas.width,
        canvas.height,
        quality.ok ? MESH_OK : MESH_WARN,
      );
      drawFaceFrame(
        ctx,
        analysis.mesh,
        canvas.width,
        canvas.height,
        quality.ok ? FRAME_OK : FRAME_WARN,
      );
    }

    const nose = analysis.mesh?.[NOSE_TIP] ?? null;
    const seen = () =>
      continuity.current?.push(
        nose ? { x: nose.x, y: nose.y } : null,
        faceCount,
        analysis.observation.faceWidthRatio,
      );

    switch (stateRef.current.name) {
      case "DETECTING":
        send({ type: "FRAME", faceCount, hint, now });
        break;

      case "FACE_DETECTED": {
        send({ type: "FRAME", faceCount, hint, now });
        if (stateRef.current.name !== "FACE_DETECTED") {
          stability.current.reset();
          break;
        }
        // several consecutive good frames before anything starts
        if (!stability.current.push(quality.ok)) break;
        // do not start an attempt that would just sit waiting for the model
        if (!isEmbedderReady()) break;

        const challenge = livenessRequired
          ? pickChallenge(
              challenges.length > 0 ? challenges : FALLBACK_POOL,
              lastChallenge.current,
            )
          : null;
        if (challenge) {
          lastChallenge.current = challenge;
          liveness.current = createLivenessSession(challenge, CHALLENGE_TIMEOUT_MS);
          continuity.current = createContinuityTracker();
          finalWait.current = 0;
          seen();
        }
        send({ type: "STABLE", challenge });
        // No challenge ran, so never claim liveness passed: if the server
        // setting changed since this page loaded, the RPC denies instead of
        // trusting a stale client.
        if (!challenge) void runAttempt(video, analysis, false);
        break;
      }

      case "CHALLENGE": {
        if (seen() === "broken") {
          liveness.current = null;
          continuity.current = null;
          send({ type: "CHALLENGE_ABORTED" });
          break;
        }
        const outcome = liveness.current?.update(analysis.signal, now);
        if (!outcome || outcome === "pending") break;

        // Done (passed or failed): needs a usable frame to capture from.
        if (!quality.ok) {
          finalWait.current += 1;
          if (finalWait.current > MAX_FINAL_WAIT_FRAMES) {
            liveness.current = null;
            continuity.current = null;
            send({ type: "CHALLENGE_ABORTED" });
          }
          break;
        }
        liveness.current = null;
        continuity.current = null;
        const passed = outcome === "passed";
        send({ type: "CHALLENGE_DONE", passed });
        void runAttempt(video, analysis, passed);
        break;
      }

      default:
        // capturing / recognizing / validating / result states ignore frames
        break;
    }
    return next;
  }, [
    videoRef,
    detector,
    stateRef,
    send,
    isEmbedderReady,
    livenessRequired,
    challenges,
    runAttempt,
  ]);

  useEffect(() => {
    if (session.status !== "ready") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (cancelled) return;
      let delay = IDLE_INTERVAL_MS;
      try {
        delay = step();
      } finally {
        timer = setTimeout(loop, delay);
      }
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session.status, step]);

  // Starts the camera by itself when the browser already remembers the
  // permission (no click needed: someone walking up is detected right away).
  // The very first grant always needs the Activar cámara click.
  const startSession = session.start;
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === "granted") void startSession();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [startSession]);

  function stop() {
    session.stop();
    liveness.current = null;
    continuity.current = null;
    stability.current.reset();
  }

  const view = resultViewFor(state);
  // While an outcome is on screen the camera tucks away (it keeps running
  // behind the scenes) and the result takes the whole stage.
  const showResult = view.kind !== "idle";
  const live = session.status === "ready";

  const prepText =
    session.status === "requesting"
      ? "Esperando el permiso de la cámara..."
      : session.status === "loading"
        ? "Cargando el reconocimiento facial..."
        : session.status === "off"
          ? "Cámara desactivada"
          : null;
  const banner =
    bannerFor(state) ??
    (prepText ? { text: prepText, tone: "info" as Tone, pulse: false } : null);

  return (
    <div className="flex flex-col gap-4">
      {!livenessRequired && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-warning" />
          <p>
            <strong>Modo de prueba: sin prueba de vida.</strong> Una foto o un
            video podrían engañar al sistema. Este prototipo no es un control de
            acceso seguro.
          </p>
        </div>
      )}

      <div
        className={`grid gap-5 transition-[grid-template-columns,column-gap] duration-700 ease-in-out lg:min-h-[30rem] ${
          livenessRequired
            ? "lg:h-[calc(100svh-11rem)]"
            : "lg:h-[calc(100svh-16.5rem)]"
        } ${
          showResult
            ? "lg:grid-cols-[minmax(0,0fr)_minmax(0,1fr)] lg:gap-x-0"
            : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        }`}
      >
        <div
          className={`relative overflow-hidden rounded-2xl bg-neutral-900 shadow-lg transition-all duration-700 ease-in-out lg:min-h-0 ${
            showResult
              ? "min-h-0 scale-90 opacity-0 max-lg:h-0"
              : "min-h-[65svh] scale-100 opacity-100"
          }`}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 size-full -scale-x-100 object-cover"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover"
          />

          {state.name === "DETECTING" && (
            <div className="pointer-events-none absolute left-1/2 top-[45%] aspect-[3/4] h-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/50" />
          )}

          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            <span
              className={`size-2 rounded-full ${live ? "animate-pulse bg-success" : "bg-white/50"}`}
            />
            {live ? "Cámara activa" : "Cámara apagada"}
            {live && (
              <span className="text-white/70">
                · {backend === "webgpu" ? "GPU" : backend === "wasm" ? "CPU" : "cargando modelo"}
              </span>
            )}
          </div>

          {(session.status === "requesting" ||
            session.status === "loading" ||
            live) && (
            <div className="absolute right-4 top-4">
              <Button size="sm" variant="secondary" onClick={stop}>
                Detener
              </Button>
            </div>
          )}

          {(session.status === "off" || session.status === "error") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-neutral-900/80 p-6 text-center text-white">
              <ScanFaceIcon className="size-20 opacity-80" />
              <p className="max-w-xs text-lg opacity-90">
                {session.status === "error"
                  ? "No se pudo iniciar la cámara"
                  : "Activá la cámara para empezar a verificar accesos"}
              </p>
              <Button size="lg" onClick={() => void session.start()}>
                <CameraIcon />
                {session.status === "error" ? "Reintentar" : "Activar cámara"}
              </Button>
            </div>
          )}

          <KioskStageOverlay state={state} />

          {banner && !showResult && (
            <div
              role="status"
              aria-live="polite"
              className={`absolute inset-x-0 bottom-0 px-5 py-4 text-center text-xl font-semibold backdrop-blur-md md:text-2xl ${TONE_CLASS[banner.tone]} ${
                banner.pulse ? "animate-pulse text-3xl md:text-4xl" : ""
              }`}
            >
              {banner.text}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-5">
          <div className="min-h-48 flex-1 lg:min-h-0">
            <AccessResultPanel view={view} expanded={showResult} />
          </div>
        </div>
      </div>
    </div>
  );
}

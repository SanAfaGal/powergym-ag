"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CameraIcon, ScanFaceIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attemptAccess, type AccessAttemptResult } from "../actions";
import { SimulatedBarrier } from "../lib/barrier/SimulatedBarrier";
import { pickChallenge } from "../lib/challengePicker";
import { cosineSimilarity } from "../lib/embedding";
import {
  createLivenessSession,
  type LivenessChallenge,
} from "../lib/liveness";
import { evaluateFrameQuality, type QualityVerdict } from "../lib/quality";
import { createStabilityTracker } from "../lib/stability";
import { cameraErrorMessage, qualityMessage } from "../lib/uiMessages";
import { drawFaceMesh } from "../lib/vision/drawMesh";
import type { FrameAnalysis } from "../lib/vision/faceDetector";
import { useCameraSession } from "../useCameraSession";
import { AccessResultPanel } from "./AccessResultPanel";
import { BarrierIndicator } from "./BarrierIndicator";

// Fast while someone is in front of the camera (smooth mesh, ~0.6 s of
// steadiness at STABLE_FRAMES), slow while the frame is empty.
const ACTIVE_INTERVAL_MS = 120;
const IDLE_INTERVAL_MS = 400;
const STABLE_FRAMES = 5;
const MESH_OK = "rgba(74, 222, 128, 0.55)";
const MESH_WARN = "rgba(251, 191, 36, 0.55)";
const CHALLENGE_TIMEOUT_MS = 6000;
// Long enough to read the richer result card, plus the camera-hide transition.
const RESULT_MS = 6500;
// The embedding taken after the challenge must resemble the one taken before
// it, so the person who passed the challenge is the person being identified
// (provisional value, to be calibrated with real faces).
const IDENTITY_CONTINUITY_MIN = 0.5;
const MAX_FINAL_WAIT_FRAMES = 20;

// A pool that is somehow empty falls back to blink rather than crashing the
// kiosk (the database already refuses an empty pool while liveness is on).
const FALLBACK_POOL: LivenessChallenge[] = ["blink"];

const CHALLENGE_PROMPT: Record<LivenessChallenge, string> = {
  blink: "Parpadeá una vez para confirmar",
  open_mouth: "Abrí la boca para confirmar",
  smile: "Sonreí para confirmar",
  turn_any: "Girá la cabeza hacia un lado",
  turn_left: "Girá la cabeza hacia tu izquierda",
  turn_right: "Girá la cabeza hacia tu derecha",
};

type Phase = "searching" | "challenge" | "processing" | "result";

type Tone = "info" | "warn" | "ok" | "error";

// Solid-ish backgrounds so the instruction stays readable over any camera
// image, in a bright gym or a dark room.
const TONE_CLASS: Record<Tone, string> = {
  info: "bg-background/85 text-foreground",
  warn: "bg-warning/90 text-warning-foreground",
  ok: "bg-success/90 text-success-foreground",
  error: "bg-destructive/90 text-white",
};

function deviceLabel() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Celular"
    : "Computador";
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

  const [barrier] = useState(() => new SimulatedBarrier());
  const barrierState = useSyncExternalStore(
    barrier.subscribe.bind(barrier),
    () => barrier.state,
    () => "locked" as const,
  );

  const [phase, setPhase] = useState<Phase>("searching");
  const [verdict, setVerdict] = useState<QualityVerdict | null>(null);
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [result, setResult] = useState<AccessAttemptResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tracker = useRef(createStabilityTracker(STABLE_FRAMES));
  const liveness = useRef<ReturnType<typeof createLivenessSession> | null>(null);
  // Embeddings live only in these refs, for the length of one attempt.
  const probePromise = useRef<Promise<number[]> | null>(null);
  const finalWait = useRef(0);
  const busy = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastChallenge = useRef<LivenessChallenge | null>(null);
  // After a result the kiosk waits for the person to leave the frame, so a
  // visitor standing in front of the camera is not re-evaluated in a loop.
  const armed = useRef(true);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    },
    [],
  );

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

  const submit = useCallback(
    async (livenessPassed: boolean, embedding: number[]) => {
      busy.current = true;
      setPhase("processing");

      probePromise.current = null;
      finalWait.current = 0;

      const outcome = await attemptAccess({
        embedding,
        livenessPassed,
        deviceLabel: deviceLabel(),
      });
      if ("error" in outcome) {
        setErrorMessage(outcome.error);
        setPhase("searching");
        busy.current = false;
        return;
      }

      setErrorMessage(null);
      setResult(outcome.result);
      setPhase("result");
      armed.current = false;
      if (outcome.result.decision === "granted") void barrier.open();

      resultTimer.current = setTimeout(() => {
        setResult(null);
        setPhase("searching");
        tracker.current.reset();
        busy.current = false;
      }, RESULT_MS);
    },
    [barrier],
  );

  // Ends an attempt. The identity embedding (taken in the background while
  // the person did the gesture) is awaited here; after a passed challenge a
  // FRESH frame is embedded and must match it, tying the live gesture to the
  // face being identified.
  const finish = useCallback(
    async (
      passed: boolean,
      fresh?: { video: HTMLVideoElement; analysis: FrameAnalysis },
    ) => {
      busy.current = true;
      liveness.current = null;
      setChallenge(null);
      try {
        const before = await probePromise.current;
        if (!before) throw new Error("no identity embedding");
        if (passed && fresh) {
          const after = await (await getEmbedder()).embed(fresh.video, fresh.analysis);
          const sameFace = cosineSimilarity(before, after) >= IDENTITY_CONTINUITY_MIN;
          await submit(sameFace, after);
        } else {
          await submit(false, before);
        }
      } catch {
        probePromise.current = null;
        busy.current = false;
        setPhase("searching");
        setErrorMessage("No se pudo procesar el rostro, intentá de nuevo");
      }
    },
    [getEmbedder, submit],
  );

  // One detection step; returns how long to wait before the next one. With
  // nobody in front of the camera it polls slowly (cheap), and speeds up as
  // soon as a face appears.
  const step = useCallback((): number => {
    const video = videoRef.current;
    const live = detector.current;
    if (!video || !live) return IDLE_INTERVAL_MS;

    const analysis = live.detect(video, performance.now());
    const quality = evaluateFrameQuality(analysis.observation);
    const next =
      analysis.observation.faceCount > 0 ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
    setVerdict((prev) =>
      prev && prev.ok === quality.ok && (quality.ok || (!prev.ok && prev.reason === quality.reason))
        ? prev
        : quality,
    );

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
    }

    if (!armed.current) {
      if (!quality.ok && quality.reason === "no_face") armed.current = true;
      return next;
    }

    if (liveness.current) {
      // A second person stepping in cancels the challenge.
      if (!quality.ok && quality.reason === "multiple_faces") {
        void finish(false);
        return next;
      }

      const state = liveness.current.update(analysis.signal, performance.now());
      if (state === "pending") return next;
      if (state === "failed") {
        void finish(false);
        return next;
      }

      // Passed: wait for a usable frame to take the fresh embedding from.
      if (!quality.ok) {
        finalWait.current += 1;
        if (finalWait.current > MAX_FINAL_WAIT_FRAMES) void finish(false);
        return next;
      }
      void finish(true, { video, analysis });
      return next;
    }

    if (busy.current || !tracker.current.push(quality.ok)) return next;
    // Do not start an attempt that would just sit waiting for the model.
    if (!isEmbedderReady()) return next;

    if (livenessRequired) {
      // The challenge shows up right away; the identity embedding is computed
      // in the background while the person performs the gesture.
      const embedding = getEmbedder().then((m) => m.embed(video, analysis));
      embedding.catch(() => {});
      probePromise.current = embedding;
      finalWait.current = 0;
      const chosen = pickChallenge(
        challenges.length > 0 ? challenges : FALLBACK_POOL,
        lastChallenge.current,
      );
      lastChallenge.current = chosen;
      liveness.current = createLivenessSession(chosen, CHALLENGE_TIMEOUT_MS);
      setChallenge(chosen);
      setPhase("challenge");
      return next;
    }

    // No challenge ran, so never claim liveness passed: if the server setting
    // changed since this page loaded, the RPC denies instead of trusting a
    // stale client.
    busy.current = true;
    void (async () => {
      try {
        const embedding = await (await getEmbedder()).embed(video, analysis);
        await submit(false, embedding);
      } catch {
        busy.current = false;
        setErrorMessage("No se pudo procesar el rostro, intentá de nuevo");
      }
    })();
    return next;
  }, [
    videoRef,
    detector,
    getEmbedder,
    isEmbedderReady,
    livenessRequired,
    challenges,
    submit,
    finish,
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
    if (resultTimer.current) clearTimeout(resultTimer.current);
    liveness.current = null;
    probePromise.current = null;
    busy.current = false;
    armed.current = true;
    tracker.current.reset();
    setPhase("searching");
    setChallenge(null);
    setResult(null);
    setVerdict(null);
  }

  let hint = "Cámara desactivada";
  if (session.status === "requesting") hint = "Esperando el permiso de la cámara...";
  else if (session.status === "loading") hint = "Cargando el reconocimiento facial...";
  else if (session.status === "error" && session.error) {
    hint = cameraErrorMessage(session.error);
  } else if (session.status === "ready") {
    if (phase === "processing") hint = "Procesando...";
    else if (phase === "challenge" && challenge) hint = CHALLENGE_PROMPT[challenge];
    else if (phase === "result") hint = "";
    else if (verdict === null) hint = "Buscando un rostro...";
    else hint = verdict.ok ? "Rostro detectado" : qualityMessage(verdict.reason);
  }

  const message = errorMessage ?? hint;
  const tone: Tone =
    errorMessage || session.status === "error"
      ? "error"
      : session.status !== "ready"
        ? "info"
        : phase === "challenge" || (verdict?.ok && phase === "searching")
          ? "ok"
          : verdict && !verdict.ok && verdict.reason !== "no_face"
            ? "warn"
            : "info";

  const ring =
    phase === "result" && result
      ? result.decision === "granted"
        ? "ring-4 ring-success"
        : "ring-4 ring-destructive"
      : "";

  // While a result is on screen the camera tucks away (it keeps running behind
  // the scenes) and the result takes the whole stage.
  const showResult = phase === "result" && result !== null;
  const live = session.status === "ready";
  const showGuide = live && phase === "searching";

  return (
    <div
      className={`grid gap-5 transition-[grid-template-columns,column-gap] duration-700 ease-in-out lg:h-[calc(100svh-11rem)] lg:min-h-[30rem] ${
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
        } ${ring}`}
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

        {showGuide && (
          <div
            className={`pointer-events-none absolute left-1/2 top-[45%] aspect-[3/4] h-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed transition-colors duration-300 ${
              tone === "ok" ? "border-success/80" : "border-white/50"
            }`}
          />
        )}

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          <span
            className={`size-2 rounded-full ${live ? "animate-pulse bg-success" : "bg-white/50"}`}
          />
          {live ? "Cámara activa" : "Cámara apagada"}
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

        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`absolute inset-x-0 bottom-0 px-5 py-4 text-center text-xl font-semibold backdrop-blur-md md:text-2xl ${TONE_CLASS[tone]} ${
              phase === "challenge" ? "animate-pulse text-3xl md:text-4xl" : ""
            }`}
          >
            {message}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-5">
        <div className="min-h-48 flex-1 lg:min-h-0">
          <AccessResultPanel result={result} expanded={showResult} />
        </div>
        <BarrierIndicator state={barrierState} />
      </div>
    </div>
  );
}

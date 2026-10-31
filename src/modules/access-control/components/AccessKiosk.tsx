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
import { useCameraSession } from "../useCameraSession";
import { AccessResultPanel } from "./AccessResultPanel";
import { BarrierIndicator } from "./BarrierIndicator";

// Fast enough for a smooth mesh; STABLE_FRAMES keeps the ~1 s of steadiness.
const DETECT_INTERVAL_MS = 120;
const STABLE_FRAMES = 8;
const MESH_OK = "rgba(74, 222, 128, 0.55)";
const MESH_WARN = "rgba(251, 191, 36, 0.55)";
const CHALLENGE_TIMEOUT_MS = 6000;
const RESULT_MS = 4000;
// The embedding taken after the challenge must resemble the one taken before
// it, so the person who passed the challenge is the person being identified
// (provisional value, to be calibrated with real faces).
const IDENTITY_CONTINUITY_MIN = 0.5;
const MAX_FINAL_WAIT_FRAMES = 20;

// Drawn at random per attempt (never the same twice in a row). All of them
// are independent of the sign of yaw, which is still unverified with a real
// face; turn_left / turn_right stay out of the pool until it is.
const CHALLENGES: LivenessChallenge[] = ["blink", "open_mouth", "smile", "turn_any"];

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

export function AccessKiosk({ livenessRequired }: { livenessRequired: boolean }) {
  const session = useCameraSession();
  const { videoRef, detector, getEmbedder } = session;

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
  const probe = useRef<number[] | null>(null);
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

      probe.current = null;
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

  useEffect(() => {
    if (session.status !== "ready") return;

    const timer = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !detector.current) return;

      const analysis = detector.current.detect(video, performance.now());
      const quality = evaluateFrameQuality(analysis.observation);
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
          detector.current.connections,
          canvas.width,
          canvas.height,
          quality.ok ? MESH_OK : MESH_WARN,
        );
      }

      if (!armed.current) {
        if (!quality.ok && quality.reason === "no_face") armed.current = true;
        return;
      }

      if (liveness.current) {
        const before = probe.current;
        // A second person stepping in cancels the challenge.
        if (!before || (!quality.ok && quality.reason === "multiple_faces")) {
          liveness.current = null;
          setChallenge(null);
          if (before) await submit(false, before);
          return;
        }

        const state = liveness.current.update(analysis.signal, performance.now());
        if (state === "pending") return;

        if (state === "failed") {
          liveness.current = null;
          setChallenge(null);
          await submit(false, before);
          return;
        }

        // Passed: identify from a FRESH frame taken after the challenge and
        // require it to match the pre-challenge one, so the live gesture is
        // tied to the face being identified.
        if (!quality.ok) {
          finalWait.current += 1;
          if (finalWait.current > MAX_FINAL_WAIT_FRAMES) {
            liveness.current = null;
            setChallenge(null);
            await submit(false, before);
          }
          return;
        }
        busy.current = true;
        liveness.current = null;
        setChallenge(null);
        try {
          const after = await (await getEmbedder()).embed(video, analysis);
          const sameFace = cosineSimilarity(before, after) >= IDENTITY_CONTINUITY_MIN;
          await submit(sameFace, after);
        } catch {
          busy.current = false;
          setErrorMessage("No se pudo procesar el rostro, intentá de nuevo");
        }
        return;
      }

      if (busy.current) return;
      if (!tracker.current.push(quality.ok)) return;

      busy.current = true;
      let first: number[];
      try {
        first = await (await getEmbedder()).embed(video, analysis);
      } catch {
        busy.current = false;
        setErrorMessage("No se pudo procesar el rostro, intentá de nuevo");
        return;
      }

      if (livenessRequired) {
        probe.current = first;
        finalWait.current = 0;
        const chosen = pickChallenge(CHALLENGES, lastChallenge.current);
        lastChallenge.current = chosen;
        liveness.current = createLivenessSession(chosen, CHALLENGE_TIMEOUT_MS);
        setChallenge(chosen);
        setPhase("challenge");
        busy.current = false;
      } else {
        // No challenge ran, so never claim liveness passed: if the server
        // setting changed since this page loaded, the RPC denies instead of
        // trusting a stale client.
        await submit(false, first);
      }
    }, DETECT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [session.status, videoRef, detector, getEmbedder, livenessRequired, submit]);

  function stop() {
    session.stop();
    if (resultTimer.current) clearTimeout(resultTimer.current);
    liveness.current = null;
    probe.current = null;
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

  const live = session.status === "ready";
  const showGuide = live && phase === "searching";

  return (
    <div className="grid gap-5 lg:h-[calc(100svh-11rem)] lg:min-h-[30rem] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div
        className={`relative min-h-[65svh] overflow-hidden rounded-2xl bg-neutral-900 shadow-lg lg:min-h-0 ${ring}`}
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
        <div className="min-h-0 flex-1">
          <AccessResultPanel result={result} />
        </div>
        <BarrierIndicator state={barrierState} />
      </div>
    </div>
  );
}

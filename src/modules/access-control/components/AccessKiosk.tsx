"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { attemptAccess, type AccessAttemptResult } from "../actions";
import { SimulatedBarrier } from "../lib/barrier/SimulatedBarrier";
import {
  createLivenessSession,
  type LivenessChallenge,
} from "../lib/liveness";
import { evaluateFrameQuality, type QualityVerdict } from "../lib/quality";
import { createStabilityTracker } from "../lib/stability";
import { cameraErrorMessage, qualityMessage } from "../lib/uiMessages";
import { useCameraSession } from "../useCameraSession";
import { AccessResultPanel } from "./AccessResultPanel";
import { BarrierIndicator } from "./BarrierIndicator";

const DETECT_INTERVAL_MS = 300;
const STABLE_FRAMES = 3;
const CHALLENGE_TIMEOUT_MS = 6000;
const RESULT_MS = 4000;

// Only blink for now: the sign of yaw against the person's real left/right
// still has to be confirmed with a real face (docs/access-control/
// decisions.md), and a wrong sign would make every turn challenge fail.
const CHALLENGES: LivenessChallenge[] = ["blink"];

const CHALLENGE_PROMPT: Record<LivenessChallenge, string> = {
  blink: "Parpadeá una vez para confirmar",
  turn_left: "Girá la cabeza hacia tu izquierda",
  turn_right: "Girá la cabeza hacia tu derecha",
};

type Phase = "searching" | "challenge" | "processing" | "result";

function deviceLabel() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Celular"
    : "Computador";
}

export function AccessKiosk({ livenessRequired }: { livenessRequired: boolean }) {
  const session = useCameraSession();
  const { videoRef, detector, embedder } = session;

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
  // The probe embedding lives only in this ref, for the length of one attempt.
  const probe = useRef<number[] | null>(null);
  const busy = useRef(false);
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
    async (livenessPassed: boolean) => {
      const embedding = probe.current;
      if (!embedding) return;
      busy.current = true;
      setPhase("processing");

      const outcome = await attemptAccess({
        embedding,
        livenessPassed,
        deviceLabel: deviceLabel(),
      });
      probe.current = null;

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
      if (!video || !detector.current || !embedder.current) return;

      const analysis = detector.current.detect(video, performance.now());
      const quality = evaluateFrameQuality(analysis.observation);
      setVerdict(quality);

      if (!armed.current) {
        if (!quality.ok && quality.reason === "no_face") armed.current = true;
        return;
      }

      if (liveness.current) {
        const state = liveness.current.update(analysis.signal, performance.now());
        if (state !== "pending") {
          liveness.current = null;
          setChallenge(null);
          await submit(state === "passed");
        }
        return;
      }

      if (busy.current) return;
      if (!tracker.current.push(quality.ok)) return;

      busy.current = true;
      try {
        probe.current = await embedder.current.embed(video, analysis);
      } catch {
        busy.current = false;
        setErrorMessage("No se pudo procesar el rostro, intentá de nuevo");
        return;
      }

      if (livenessRequired) {
        const chosen = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        liveness.current = createLivenessSession(chosen, CHALLENGE_TIMEOUT_MS);
        setChallenge(chosen);
        setPhase("challenge");
        busy.current = false;
      } else {
        await submit(true);
      }
    }, DETECT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [session.status, videoRef, detector, embedder, livenessRequired, submit]);

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

  const ring =
    phase === "result" && result
      ? result.decision === "granted"
        ? "ring-4 ring-success"
        : "ring-4 ring-destructive"
      : "";

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`aspect-[3/4] w-full -scale-x-100 rounded-lg bg-muted object-cover md:aspect-[4/3] ${ring}`}
        />
        <p className="min-h-6 text-center text-sm text-muted-foreground" aria-live="polite">
          {errorMessage ?? hint}
        </p>
        <div className="flex justify-center">
          {session.status === "off" || session.status === "error" ? (
            <Button onClick={() => void session.start()}>
              {session.status === "error" ? "Reintentar" : "Activar cámara"}
            </Button>
          ) : (
            <Button variant="outline" onClick={stop}>
              Detener
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-6">
        {result ? (
          <AccessResultPanel result={result} />
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            El resultado del acceso aparece acá.
          </div>
        )}
        <BarrierIndicator state={barrierState} />
      </div>
    </div>
  );
}

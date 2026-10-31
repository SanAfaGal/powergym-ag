"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { enrollFace, uploadClientPhoto } from "../actions";
import type { EnrollmentStatus } from "../queries";
import { CONSENT_TEXT_VERSION } from "../lib/consent";
import { captureQualityScore, evaluateFrameQuality } from "../lib/quality";
import { createStabilityTracker } from "../lib/stability";
import { cameraErrorMessage, qualityMessage } from "../lib/uiMessages";
import { drawFaceMesh } from "../lib/vision/drawMesh";
import { captureJpeg } from "../lib/vision/capturePhoto";
import type { FrameAnalysis } from "../lib/vision/faceDetector";
import { useCameraSession } from "../useCameraSession";
import { ConsentDialog } from "./ConsentDialog";
import { DeleteFaceTemplateDialog } from "./DeleteFaceTemplateDialog";

// One row of the enrollment flow: a number (a check once done), what it is and,
// on the right, the action that moves it forward.
function Step({
  n,
  done,
  title,
  hint,
  action,
}: {
  n: number;
  done: boolean;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 rounded-md border border-border p-4">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckIcon className="size-5" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {action}
    </li>
  );
}

const CAPTURES_NEEDED = 3;
const DETECT_INTERVAL_MS = 120;
// ~1 s of consecutive good frames before each automatic capture.
const STABLE_FRAMES = 8;
const PAUSE_BETWEEN_CAPTURES_MS = 900;
const MODEL_ID = "auraface-glintr100";
const MODEL_VERSION = "v1";
const MESH_OK = "rgba(74, 222, 128, 0.7)";
const MESH_WARN = "rgba(251, 191, 36, 0.7)";

export function FaceEnrollmentCard({
  clientId,
  clientName,
  isAdmin,
  status,
}: {
  clientId: string;
  clientName: string;
  isAdmin: boolean;
  status: EnrollmentStatus;
}) {
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  // "ok", a quality reason, or null before the first frame. A plain string,
  // so the 120 ms loop only re-renders when the message actually changes.
  const [frameState, setFrameState] = useState<string | null>(null);

  const session = useCameraSession();
  const { videoRef, detector } = session;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracker = useRef(createStabilityTracker(STABLE_FRAMES));
  const busyRef = useRef(false);
  const pauseUntil = useRef(0);
  // Embeddings only live here until they are sent; never in state or storage.
  const embeddings = useRef<number[][]>([]);
  const scores = useRef<number[]>([]);
  // The still of the latest good capture; uploaded once the face is enrolled.
  const photo = useRef<Blob | null>(null);

  function reset() {
    photo.current = null;
    embeddings.current = [];
    scores.current = [];
    tracker.current.reset();
    setCount(0);
    setFrameState(null);
  }

  function close() {
    session.stop();
    reset();
    busyRef.current = false;
    setBusy(false);
    setCapturing(false);
  }

  async function capture(analysis: FrameAnalysis) {
    const video = videoRef.current;
    if (!video) return;

    busyRef.current = true;
    setBusy(true);
    try {
      const embedder = await session.getEmbedder();
      embeddings.current.push(await embedder.embed(video, analysis));
      scores.current.push(captureQualityScore(analysis.observation));
      photo.current = (await captureJpeg(video, analysis.mesh)) ?? photo.current;
      setCount(embeddings.current.length);
      pauseUntil.current = performance.now() + PAUSE_BETWEEN_CAPTURES_MS;
      tracker.current.reset();

      if (embeddings.current.length < CAPTURES_NEEDED) return;

      const quality =
        scores.current.reduce((sum, s) => sum + s, 0) / scores.current.length;
      const result = await enrollFace({
        clientId,
        embeddings: embeddings.current,
        quality,
        consentTextVersion: CONSENT_TEXT_VERSION,
        modelId: MODEL_ID,
        modelVersion: MODEL_VERSION,
      });
      if ("error" in result) {
        toast.error(result.error);
        reset();
        return;
      }

      // The photo is a plus: the face is already enrolled if it fails.
      let photoSaved = false;
      if (photo.current) {
        const body = new FormData();
        body.set("photo", photo.current, "foto.jpg");
        photoSaved = !("error" in (await uploadClientPhoto(clientId, body)));
      }
      if (photoSaved) toast.success("Rostro y foto registrados");
      else toast.warning("Rostro registrado, pero no se pudo guardar la foto");
      close();
    } catch {
      toast.error("No se pudo procesar el rostro, intentá de nuevo");
      reset();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Opening the capture dialog turns the camera on by itself. The <video> lives
  // inside the dialog, which mounts a moment after `capturing` flips, so wait
  // (a few frames at most) for it to exist before starting.
  useEffect(() => {
    if (!capturing || session.status !== "off") return;
    let frame = 0;
    let tries = 0;
    const tryStart = () => {
      if (videoRef.current) {
        void session.start();
        return;
      }
      if (++tries < 60) frame = requestAnimationFrame(tryStart);
    };
    frame = requestAnimationFrame(tryStart);
    return () => cancelAnimationFrame(frame);
    // session.start is stable; the session object itself changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, session.status]);

  // Frame loop: detect, draw the mesh and capture automatically once the
  // face has been well aligned for a moment.
  useEffect(() => {
    if (!capturing || session.status !== "ready") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !detector.current) return;

      const analysis = detector.current.detect(video, performance.now());
      const verdict = evaluateFrameQuality(analysis.observation);
      setFrameState(verdict.ok ? "ok" : verdict.reason);

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
          verdict.ok ? MESH_OK : MESH_WARN,
        );
      }

      if (busyRef.current || performance.now() < pauseUntil.current) return;
      if (tracker.current.push(verdict.ok)) void capture(analysis);
    }, DETECT_INTERVAL_MS);
    return () => clearInterval(timer);
    // capture() only touches refs and stable setters; re-creating the
    // interval on every render would reset the stability streak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, session.status]);

  let hint = "Cámara desactivada";
  if (session.status === "requesting") hint = "Esperando el permiso de la cámara...";
  else if (session.status === "loading") hint = "Cargando el reconocimiento facial...";
  else if (session.status === "error" && session.error) {
    hint = cameraErrorMessage(session.error);
  } else if (session.status === "ready") {
    if (busy) hint = "Procesando...";
    else if (frameState === null) hint = "Buscando un rostro...";
    else if (frameState === "ok") hint = "Rostro alineado. Mantenelo quieto";
    else {
      hint = qualityMessage(
        frameState as Parameters<typeof qualityMessage>[0],
      );
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              Acceso facial
              {status.hasTemplate && (
                <Badge className="bg-success/10 text-success">Registrado</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {status.hasTemplate
                ? `Rostro registrado${status.enrolledAt ? ` el ${new Date(status.enrolledAt).toLocaleDateString("es-CO")}` : ""}.`
                : status.hasConsent
                  ? "Consentimiento registrado. Falta registrar el rostro."
                  : "Sin consentimiento"}
            </CardDescription>
          </div>

          <ol className="flex flex-col gap-3">
            <Step
              n={1}
              done={status.hasConsent}
              title="Consentimiento"
              hint="La persona autoriza el uso de su rostro."
              action={
                !status.hasConsent && (
                  <ConsentDialog clientId={clientId} clientName={clientName} />
                )
              }
            />
            <Step
              n={2}
              done={status.hasTemplate}
              title="Rostro"
              hint="Se captura frente a la cámara, de forma automática. Se guarda también una foto, que solo ve el personal."
              action={
                <Button
                  size="sm"
                  variant={status.hasConsent && !status.hasTemplate ? "default" : "outline"}
                  disabled={!status.hasConsent}
                  onClick={() => setCapturing(true)}
                >
                  {status.hasTemplate ? "Volver a registrar" : "Registrar rostro"}
                </Button>
              }
            />
          </ol>

          {isAdmin && (status.hasConsent || status.hasTemplate) && (
            <div className="border-t border-border pt-4">
              <DeleteFaceTemplateDialog clientId={clientId} clientName={clientName} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={capturing} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar rostro de {clientName}</DialogTitle>
            <DialogDescription>
              Mirá de frente a la cámara. La captura es automática cuando el
              rostro está alineado.
            </DialogDescription>
          </DialogHeader>

          <div className="relative -scale-x-100 overflow-hidden rounded-md bg-muted">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {hint}
          </p>

          {session.status === "ready" && (
            <div
              className="flex items-center gap-2 text-sm"
              aria-label={`Capturas ${count} de ${CAPTURES_NEEDED}`}
            >
              {Array.from({ length: CAPTURES_NEEDED }, (_, i) => (
                <span
                  key={i}
                  className={`size-3 rounded-full ${
                    i < count ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
              <span className="text-muted-foreground">
                {count} de {CAPTURES_NEEDED}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(session.status === "off" || session.status === "error") && (
              <Button size="sm" onClick={() => void session.start()}>
                {session.status === "error" ? "Reintentar" : "Activar cámara"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={close}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

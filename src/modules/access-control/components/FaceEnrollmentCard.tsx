"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { enrollFace } from "../actions";
import type { EnrollmentStatus } from "../queries";
import { CONSENT_TEXT_VERSION } from "../lib/consent";
import { captureQualityScore, evaluateFrameQuality, type QualityVerdict } from "../lib/quality";
import { cameraErrorMessage, qualityMessage } from "../lib/uiMessages";
import type { FrameAnalysis } from "../lib/vision/faceDetector";
import { useCameraSession } from "../useCameraSession";
import { ConsentDialog } from "./ConsentDialog";
import { DeleteFaceTemplateDialog } from "./DeleteFaceTemplateDialog";

const CAPTURES_NEEDED = 3;
const DETECT_INTERVAL_MS = 400;
const MODEL_ID = "auraface-glintr100";
const MODEL_VERSION = "v1";

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
  const [verdict, setVerdict] = useState<QualityVerdict | null>(null);

  const session = useCameraSession();
  const { videoRef, detector, embedder } = session;
  const latest = useRef<{ analysis: FrameAnalysis; verdict: QualityVerdict } | null>(null);
  // Embeddings only live here until they are sent; never in state or storage.
  const embeddings = useRef<number[][]>([]);
  const scores = useRef<number[]>([]);

  // Frame loop: detect + judge quality while the models are ready.
  useEffect(() => {
    if (!capturing || session.status !== "ready") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || !detector.current) return;
      const analysis = detector.current.detect(video, performance.now());
      const result = evaluateFrameQuality(analysis.observation);
      latest.current = { analysis, verdict: result };
      setVerdict(result);
    }, DETECT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [capturing, session.status, videoRef, detector]);

  function reset() {
    embeddings.current = [];
    scores.current = [];
    latest.current = null;
    setCount(0);
    setVerdict(null);
  }

  function close() {
    session.stop();
    reset();
    setCapturing(false);
  }

  async function capture() {
    const frame = latest.current;
    const video = videoRef.current;
    if (!frame || !frame.verdict.ok || !video || !embedder.current || busy) return;

    setBusy(true);
    try {
      embeddings.current.push(await embedder.current.embed(video, frame.analysis));
      scores.current.push(captureQualityScore(frame.analysis.observation));
      setCount(embeddings.current.length);

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
      toast.success("Rostro registrado");
      close();
    } catch {
      toast.error("No se pudo procesar el rostro, intentá de nuevo");
      reset();
    } finally {
      setBusy(false);
    }
  }

  const canCapture =
    session.status === "ready" && verdict?.ok === true && !busy;

  let hint = "Cámara desactivada";
  if (session.status === "requesting") hint = "Esperando el permiso de la cámara...";
  else if (session.status === "loading") hint = "Cargando el reconocimiento facial...";
  else if (session.status === "error" && session.error) hint = cameraErrorMessage(session.error);
  else if (session.status === "ready") {
    hint = busy
      ? "Procesando..."
      : verdict === null
        ? "Buscando un rostro..."
        : verdict.ok
          ? "Rostro detectado"
          : qualityMessage(verdict.reason);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
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
      </CardHeader>
      <CardContent className="space-y-4">
        {capturing && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full max-w-sm -scale-x-100 rounded-md bg-muted object-cover"
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {hint}
            </p>
            {session.status === "ready" && (
              <p className="text-sm">
                Captura {Math.min(count + 1, CAPTURES_NEEDED)} de {CAPTURES_NEEDED}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(session.status === "off" || session.status === "error") && (
                <Button size="sm" onClick={() => void session.start()}>
                  {session.status === "error" ? "Reintentar" : "Activar cámara"}
                </Button>
              )}
              {session.status === "ready" && (
                <SubmitButton
                  type="button"
                  size="sm"
                  onClick={() => void capture()}
                  pending={busy}
                  pendingLabel="Procesando..."
                  disabled={!canCapture}
                >
                  Capturar
                </SubmitButton>
              )}
              <Button size="sm" variant="outline" onClick={close}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!capturing && (
          <div className="flex flex-wrap gap-2">
            {!status.hasConsent && (
              <ConsentDialog clientId={clientId} clientName={clientName} />
            )}
            <Button
              size="sm"
              variant={status.hasConsent ? "default" : "outline"}
              disabled={!status.hasConsent}
              onClick={() => setCapturing(true)}
            >
              {status.hasTemplate ? "Volver a registrar" : "Registrar rostro"}
            </Button>
            {isAdmin && (status.hasConsent || status.hasTemplate) && (
              <DeleteFaceTemplateDialog clientId={clientId} clientName={clientName} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type CameraErrorKind = "denied" | "not_found" | "in_use" | "unsupported";

export class CameraError extends Error {
  kind: CameraErrorKind;
  constructor(kind: CameraErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

function classify(error: unknown): CameraErrorKind {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotReadableError" || name === "AbortError") return "in_use";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "not_found";
  }
  return "unsupported";
}

// Front camera at a modest resolution: enough for a 112x112 face crop and
// light on weak devices. Frames stay in the <video> element and are never
// stored or uploaded.
export async function startCamera(
  video: HTMLVideoElement,
): Promise<{ stop(): void }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("unsupported");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
        // 15 fps is plenty for alignment and saves CPU/GPU/battery.
        frameRate: { ideal: 15, max: 20 },
      },
      audio: false,
    });
  } catch (error) {
    throw new CameraError(classify(error));
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  return {
    stop() {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
  };
}

import type { QualityVerdict } from "./quality.ts";

export type CameraSessionError =
  | "denied"
  | "not_found"
  | "in_use"
  | "unsupported"
  | "model";

type QualityReason = Extract<QualityVerdict, { ok: false }>["reason"];

const QUALITY: Record<QualityReason, string> = {
  no_face: "No se detecta un rostro",
  multiple_faces: "Hay más de una persona en la imagen",
  too_far: "Acercate a la cámara",
  not_frontal: "Mirá de frente a la cámara",
  too_dark: "Hace falta más luz",
};

const CAMERA: Record<CameraSessionError, string> = {
  denied:
    "Permiso de cámara denegado. Habilitalo en el navegador y volvé a intentar",
  not_found: "No se encontró una cámara en este dispositivo",
  in_use: "La cámara está siendo usada por otra aplicación",
  unsupported:
    "Este navegador no permite usar la cámara (se necesita una conexión HTTPS)",
  model: "No se pudieron cargar los modelos de reconocimiento",
};

export function qualityMessage(reason: QualityReason): string {
  return QUALITY[reason];
}

export function cameraErrorMessage(kind: CameraSessionError): string {
  return CAMERA[kind];
}

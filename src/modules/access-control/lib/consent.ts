// Version recorded with every consent (biometric_consents.consent_text_version).
// Bump it whenever CONSENT_PARAGRAPHS changes.
//
// DRAFT wording for the prototype: it must be reviewed by legal counsel
// against Ley 1581 de 2012 and the gym's data-processing policy before real
// use.
export const CONSENT_TEXT_VERSION = "2026-10-v1";

export const CONSENT_PARAGRAPHS: string[] = [
  "PowerGym AG va a registrar una representación matemática de tu rostro (no una fotografía) para verificar tu identidad y permitirte el ingreso al gimnasio según tu membresía.",
  "Esta información se considera dato sensible. Es voluntaria: podés negarte y seguir ingresando por otro medio, sin ninguna consecuencia sobre tu membresía.",
  "Se conserva solo mientras uses este servicio. Podés pedir en cualquier momento conocer, actualizar o eliminar tu registro facial y revocar esta autorización.",
  "Cada intento de ingreso queda registrado (fecha, resultado y motivo), sin imágenes ni datos biométricos.",
];

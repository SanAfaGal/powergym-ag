// Version recorded with every consent (biometric_consents.consent_text_version).
// Bump it whenever CONSENT_PARAGRAPHS changes.
//
// DRAFT wording for the prototype: it must be reviewed by legal counsel
// against Ley 1581 de 2012 and the gym's data-processing policy before real
// use.
export const CONSENT_TEXT_VERSION = "2026-10-v2";

export const CONSENT_PARAGRAPHS: string[] = [
  "PowerGym AG va a registrar una representación matemática de tu rostro para verificar tu identidad y permitirte el ingreso al gimnasio según tu membresía.",
  "También guardará una fotografía tuya, tomada al registrarte, para que el personal pueda comprobar que eres tú. Solo la ve el personal autorizado; no se muestra en la pantalla de acceso.",
  "Esta información se considera dato sensible. Es voluntaria: podés negarte y seguir ingresando por otro medio, sin ninguna consecuencia sobre tu membresía.",
  "Se conserva solo mientras uses este servicio. Podés pedir en cualquier momento conocer, actualizar o eliminar tu registro facial y tu fotografía, y revocar esta autorización: al hacerlo se borran ambos.",
  "Cada intento de ingreso queda registrado (fecha, resultado y motivo), sin imágenes ni datos biométricos del intento.",
];

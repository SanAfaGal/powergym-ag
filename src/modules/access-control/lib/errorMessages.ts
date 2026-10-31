// Exact text of the exceptions raised by the access-control RPCs
// (migrations 0043/0044) -- matched whole so these specific, actionable
// messages reach the staff member, while any other database error falls
// back to a generic message instead of leaking raw Postgres text to the UI.
// Same pattern as the payment messages in modules/subscriptions/actions.ts.
const KNOWN: Record<string, string> = {
  "consent required": "Falta el consentimiento biométrico del cliente",
  "admin only": "Solo un administrador puede hacer esto",
  "client not found": "El cliente no existe",
  "staff only": "No tenés permisos para esta acción",
  "invalid embedding": "No se pudo leer el rostro, intentá de nuevo",
  "invalid threshold": "El umbral debe estar entre 0 y 1",
  "invalid challenges": "Elegí al menos una prueba de vida válida",
  "invalid cooldown": "La espera entre ingresos debe estar entre 0 y 60 minutos",
};

export function rpcErrorMessage(message: string, fallback: string): string {
  return KNOWN[message] ?? fallback;
}

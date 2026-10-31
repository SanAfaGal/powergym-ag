const MESSAGES: Record<string, string> = {
  ok: "Acceso autorizado",
  client_not_found: "Cliente no encontrado",
  client_inactive: "Cliente inactivo",
  no_subscription: "Sin membresía",
  subscription_pending_payment: "Membresía con pago pendiente",
  subscription_scheduled: "La membresía todavía no comenzó",
  subscription_expired: "Membresía vencida",
  subscription_canceled: "Membresía cancelada",
  face_not_recognized: "Rostro no reconocido",
  recently_admitted: "Ya registraste tu ingreso",
  liveness_failed: "No se pudo verificar que sea una persona real",
};

export function reasonMessage(code: string): string {
  return MESSAGES[code] ?? "Acceso denegado";
}

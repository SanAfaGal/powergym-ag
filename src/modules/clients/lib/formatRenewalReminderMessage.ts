function relativeWhen(endDate: string, today: string): string {
  const end = new Date(`${endDate}T00:00:00`);
  const start = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);

  if (diffDays === 1) return "mañana";
  if (diffDays === 0) return "hoy";
  return `el ${end.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" })}`;
}

// Multi-line WhatsApp reminder text -- used both as the wa.me `text` param
// and as a copy-to-clipboard message, so real line breaks (not literal \n)
// read correctly in the chat.
export function formatRenewalReminderMessage(
  firstName: string,
  endDate: string,
  today: string
): string {
  const when = relativeWhen(endDate, today);
  const fecha = new Date(`${endDate}T00:00:00`).toLocaleDateString("es-CO");

  return [
    `Hola, ${firstName}.`,
    `Te recordamos que tu membresía de PowerGym vence ${when} (${fecha}).`,
    `Si deseas renovarla, por favor presenta en recepción el correspondiente soporte de pago para realizar la renovación.`,
    `¡Te esperamos! 💪`,
  ].join("\n");
}

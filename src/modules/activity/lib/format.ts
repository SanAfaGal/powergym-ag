export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

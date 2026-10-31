// Events are stored as timestamptz; the gym works in Bogota time.
export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });
}

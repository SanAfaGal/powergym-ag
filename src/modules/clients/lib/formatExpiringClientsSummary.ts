import type { ExpiringClient } from "../queries";

export function formatExpiringClientsSummary(
  from: string,
  to: string,
  clients: ExpiringClient[]
): string {
  const fmtRange = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
  const fmtDay = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
    });

  const lines = [
    `Vencimientos ${fmtRange(from)} – ${fmtRange(to)} (${clients.length})`,
    "",
  ];

  if (clients.length === 0) {
    lines.push("- Sin clientes por vencer en este rango");
  } else {
    for (const c of clients) {
      lines.push(
        `- ${c.client_name} — vence ${fmtDay(c.end_date)}${
          c.plan_name ? ` (${c.plan_name})` : ""
        }`
      );
    }
  }

  return lines.join("\n");
}

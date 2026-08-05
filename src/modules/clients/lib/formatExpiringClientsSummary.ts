import type { ExpiringClient } from "../queries";

export function formatExpiringClientsSummary(
  from: string,
  to: string,
  clients: ExpiringClient[]
): string {
  const fmtRange = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
  const fmtDayHeader = (d: string) => {
    const date = new Date(`${d}T00:00:00`);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleDateString("es-CO", { month: "long" });
    return `${day} de ${month}`;
  };

  const lines = [`Vencimientos ${fmtRange(from)} – ${fmtRange(to)}`, ""];

  if (clients.length === 0) {
    lines.push("Sin clientes por vencer en este rango");
    return lines.join("\n");
  }

  // clients arrives sorted by end_date ascending (see listExpiringClients) --
  // grouping by date as we go preserves that order instead of re-sorting.
  let currentDate: string | null = null;
  for (const c of clients) {
    if (c.end_date !== currentDate) {
      if (currentDate !== null) lines.push("");
      lines.push(fmtDayHeader(c.end_date));
      currentDate = c.end_date;
    }
    lines.push(`- ${c.client_name}${c.plan_name ? ` (${c.plan_name})` : ""}`);
  }

  return lines.join("\n");
}

import type { DailyActivityPayment } from "../queries";

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

export function formatDailyActivityText(
  date: string,
  payments: DailyActivityPayment[]
): string {
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(
    "es-CO"
  );
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  const lines = [
    `Actividad del ${formattedDate}`,
    "",
    `Pagos (${payments.length}) — Total ${formatMoney(total)}`,
  ];

  if (payments.length === 0) {
    lines.push("- Sin pagos registrados");
  } else {
    for (const p of payments) {
      lines.push(
        `- ${p.client_name} — ${formatMoney(p.amount)} (${p.payment_method_name}) — ${p.plan_name}`
      );
    }
  }

  return lines.join("\n");
}

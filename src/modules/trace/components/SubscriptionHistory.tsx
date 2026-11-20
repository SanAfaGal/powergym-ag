import type { SubscriptionChange } from "../queries";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  pending_payment: "Pendiente de pago",
  scheduled: "Programada",
  expired: "Vencida",
  canceled: "Cancelada",
};

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const text = String(v);
  if (field === "estado") return STATUS_LABELS[text] ?? text;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [y, m, d] = text.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return text;
}

const FIELD_LABELS: Record<string, string> = {
  estado: "Estado",
  inicio: "Inicio",
  fin: "Fin",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function who(c: SubscriptionChange): string {
  if (c.source === "whatsapp") return c.by ? `WhatsApp · ${c.by}` : "WhatsApp";
  if (c.source === "panel") return c.by ? `Panel · ${c.by}` : "Panel";
  return "Sistema";
}

// Lo que le pasó a la membresía después de crearse: estado, fechas, quién y cuándo.
export function SubscriptionHistory({ changes }: { changes: SubscriptionChange[] | undefined }) {
  if (!changes || changes.length === 0) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Historial de la membresía ({changes.length})
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {changes.map((c, i) => (
          <li key={i}>
            <p>
              {formatWhen(c.at)} · {who(c)}
            </p>
            <ul className="ml-3 list-disc">
              {c.changes.map((x) => (
                <li key={x.field}>
                  {FIELD_LABELS[x.field] ?? x.field}: {formatValue(x.field, x.from)} →{" "}
                  {formatValue(x.field, x.to)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

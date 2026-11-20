import { MessageCircle, Monitor, Settings2 } from "lucide-react";
import type { Origin } from "../queries";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Una línea (y el mensaje original si vino del bot) que dice cómo y cuándo se creó algo.
export function OriginNote({
  origin,
  what,
}: {
  origin: Origin | null | undefined;
  what: string; // "Cliente" | "Membresía"
}) {
  if (!origin) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin registro de origen: se creó antes de que existiera este seguimiento.
      </p>
    );
  }

  const Icon =
    origin.source === "whatsapp"
      ? MessageCircle
      : origin.source === "panel"
        ? Monitor
        : Settings2;
  const who =
    origin.source === "whatsapp"
      ? `por WhatsApp${origin.reportedBy ? ` · lo reportó ${origin.reportedBy}` : ""}`
      : origin.source === "panel"
        ? `en el panel${origin.reportedBy ? ` por ${origin.reportedBy}` : ""}`
        : "por el sistema (importación o carga inicial)";

  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Icon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {what} creado {who} · {formatWhen(origin.at)}
        </span>
      </p>
      {origin.message && (
        <p className="rounded-md bg-muted px-2 py-1 text-xs italic">
          «{origin.message}»
        </p>
      )}
    </div>
  );
}

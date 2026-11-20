import type { ClientEdit } from "../queries";

const FIELD_LABELS: Record<string, string> = {
  first_name: "Nombre",
  last_name: "Apellido",
  alias: "Alias",
  dni_type: "Tipo de documento",
  dni_number: "Documento",
  email: "Correo",
  phone: "Teléfono",
  alternative_phone: "Teléfono alternativo",
  birth_date: "Fecha de nacimiento",
  gender: "Género",
  address: "Dirección",
  is_active: "Activo",
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

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

// Quién cambió qué en la ficha del cliente, lo más reciente primero.
export function ClientEditHistory({ edits }: { edits: ClientEdit[] }) {
  if (edits.length === 0) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Historial de cambios ({edits.length})
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {edits.map((e, i) => (
          <li key={i}>
            <p>
              {formatWhen(e.at)} · {e.by ?? "—"}
            </p>
            <ul className="ml-3 list-disc">
              {e.changes.map((c) => (
                <li key={c.field}>
                  {FIELD_LABELS[c.field] ?? c.field}: {show(c.from)} →{" "}
                  {show(c.to)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

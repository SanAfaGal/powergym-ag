import { ExpiringSoonTable } from "./ExpiringSoonTable";
import { ExpiringSoonCards } from "./ExpiringSoonCards";
import type { ExpiringRow } from "../queries";

export function ExpiringSoonList({ rows }: { rows: ExpiringRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">
          No hay suscripciones por vencer en los próximos días
        </p>
      </div>
    );
  }

  return (
    <>
      <ExpiringSoonTable rows={rows} />
      <ExpiringSoonCards rows={rows} />
    </>
  );
}

import type { AccessEvent } from "../queries";
import { AccessEventsCards } from "./AccessEventsCards";
import { AccessEventsTable } from "./AccessEventsTable";

export function AccessEventsList({
  events,
  showScore,
}: {
  events: AccessEvent[];
  showScore: boolean;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">Todavía no hay intentos de acceso</p>
      </div>
    );
  }

  return (
    <>
      <AccessEventsTable events={events} showScore={showScore} />
      <AccessEventsCards events={events} showScore={showScore} />
    </>
  );
}

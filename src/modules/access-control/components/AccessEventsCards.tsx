import { Card } from "@/components/ui/card";
import { reasonMessage } from "../lib/decisionMessages";
import { formatEventDate } from "../lib/formatEventDate";
import type { AccessEvent } from "../queries";
import { DecisionBadge } from "./AccessEventsTable";

export function AccessEventsCards({
  events,
  showScore,
}: {
  events: AccessEvent[];
  showScore: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {events.map((event) => (
        <Card key={event.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {event.clientName ?? "No identificado"}
            </span>
            <DecisionBadge decision={event.decision} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{reasonMessage(event.reasonCode)}</span>
            <span className="tabular-nums">{formatEventDate(event.occurredAt)}</span>
            <span>
              {event.deviceLabel ?? "—"}
              {showScore && event.matchScore != null
                ? ` · similitud ${event.matchScore.toFixed(2)}`
                : ""}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

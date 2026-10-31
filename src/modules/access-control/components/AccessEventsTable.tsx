import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { reasonMessage } from "../lib/decisionMessages";
import { formatEventDate } from "../lib/formatEventDate";
import type { AccessEvent } from "../queries";

export function DecisionBadge({ decision }: { decision: AccessEvent["decision"] }) {
  return decision === "granted" ? (
    <Badge className="bg-success/10 text-success">Autorizado</Badge>
  ) : (
    <Badge className="bg-destructive/10 text-destructive">Denegado</Badge>
  );
}

export function AccessEventsTable({
  events,
  showScore,
}: {
  events: AccessEvent[];
  showScore: boolean;
}) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Dispositivo</TableHead>
            {showScore && <TableHead className="text-right">Similitud</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="tabular-nums">
                {formatEventDate(event.occurredAt)}
              </TableCell>
              <TableCell>{event.clientName ?? "No identificado"}</TableCell>
              <TableCell>
                <DecisionBadge decision={event.decision} />
              </TableCell>
              <TableCell>{reasonMessage(event.reasonCode)}</TableCell>
              <TableCell>{event.deviceLabel ?? "—"}</TableCell>
              {showScore && (
                <TableCell className="text-right tabular-nums">
                  {event.matchScore != null ? event.matchScore.toFixed(2) : "—"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

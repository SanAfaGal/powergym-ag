import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import type { GlobalSubscriptionRow } from "../queries";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

export function SubscriptionTable({
  subscriptions,
}: {
  subscriptions: GlobalSubscriptionRow[];
}) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Saldo pendiente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => (
            <TableRow key={sub.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${sub.client_id}`}
                  className="hover:underline"
                >
                  {sub.client_name}
                </Link>
              </TableCell>
              <TableCell>{sub.plan_name}</TableCell>
              <TableCell className="tabular-nums">
                {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
              </TableCell>
              <TableCell>
                <SubscriptionStatusBadge status={sub.status} />
              </TableCell>
              <TableCell className="tabular-nums">
                {sub.remaining > 0
                  ? `$${sub.remaining.toLocaleString("es-CO")}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

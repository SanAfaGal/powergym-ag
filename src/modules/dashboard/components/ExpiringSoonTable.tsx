import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExpiringRow } from "../queries";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

export function ExpiringSoonTable({ rows }: { rows: ExpiringRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Saldo pendiente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.subscription_id}>
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${row.client_id}`}
                  className="hover:underline"
                >
                  {row.client_name}
                </Link>
              </TableCell>
              <TableCell>{row.plan_name}</TableCell>
              <TableCell className="tabular-nums">
                {formatDate(row.end_date)}
              </TableCell>
              <TableCell className="tabular-nums">
                {row.remaining > 0
                  ? `$${row.remaining.toLocaleString("es-CO")}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

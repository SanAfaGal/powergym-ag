import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionStatusBadge } from "@/modules/subscriptions";
import type { DebtorRow } from "../queries";

export function DebtorsTable({ debtors }: { debtors: DebtorRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Saldo pendiente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debtors.map((debtor) => (
            <TableRow key={debtor.subscription_id}>
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${debtor.client_id}`}
                  className="hover:underline"
                >
                  {debtor.client_name}
                </Link>
              </TableCell>
              <TableCell>{debtor.plan_name}</TableCell>
              <TableCell>
                <SubscriptionStatusBadge status={debtor.status} />
              </TableCell>
              <TableCell className="tabular-nums">
                ${debtor.remaining.toLocaleString("es-CO")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import Link from "next/link";
import { Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { ClientWithSubscription } from "../queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SubscriptionStatusBadge } from "@/modules/subscriptions";
import { daysRemainingClass } from "../lib/daysRemainingClass";

export function ClientTable({
  clients,
}: {
  clients: ClientWithSubscription[];
}) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Suscripción</TableHead>
            <TableHead>Días restantes</TableHead>
            <TableHead>Saldo pendiente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="sticky right-0 bg-background text-right transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--background),var(--primary)_5%)]">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${client.id}`}
                  className="hover:underline"
                >
                  {client.first_name} {client.last_name}
                </Link>
                {client.alias && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({client.alias})
                  </span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {client.dni_number ? (
                  <>
                    {client.dni_type} {client.dni_number}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {client.plan_name ?? (
                  <span className="text-muted-foreground">
                    Sin suscripción
                  </span>
                )}
              </TableCell>
              <TableCell>
                {client.subscription_status ? (
                  <SubscriptionStatusBadge status={client.subscription_status} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {client.days_remaining != null &&
                client.days_remaining >= 0 &&
                client.end_date ? (
                  <div className="flex flex-col gap-0.5 py-0.5">
                    <span
                      className={`tabular-nums font-medium ${daysRemainingClass(
                        client.days_remaining
                      )}`}
                    >
                      {client.days_remaining} días
                    </span>
                    <span className="text-xs text-muted-foreground">
                      vence{" "}
                      {new Date(
                        `${client.end_date}T00:00:00`
                      ).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {client.remaining != null && client.remaining > 0 ? (
                  `$${client.remaining.toLocaleString("es-CO")}`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge isActive={client.is_active} />
              </TableCell>
              <TableCell className="sticky right-0 bg-background text-right transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--background),var(--primary)_5%)]">
                <Button
                  render={<Link href={`/clients/${client.id}`} />}
                  nativeButton={false}
                  variant="outline"
                  size="icon-sm"
                  aria-label="Ver cliente"
                >
                  <Eye />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

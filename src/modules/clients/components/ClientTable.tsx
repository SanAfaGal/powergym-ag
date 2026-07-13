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
import type { Client } from "../queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactLinks } from "./ContactLinks";

export function ClientTable({ clients }: { clients: Client[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead className="hidden lg:table-cell">
              Cliente desde
            </TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="sticky right-0 bg-background text-right group-hover/row:bg-[color-mix(in_oklch,var(--background),var(--primary)_5%)]">
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
              <TableCell className="tabular-nums">
                {client.phone ? (
                  <ContactLinks phone={client.phone} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden tabular-nums lg:table-cell">
                {new Date(client.created_at).toLocaleDateString("es-CO")}
              </TableCell>
              <TableCell>
                <StatusBadge isActive={client.is_active} />
              </TableCell>
              <TableCell className="sticky right-0 bg-background text-right group-hover/row:bg-[color-mix(in_oklch,var(--background),var(--primary)_5%)]">
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

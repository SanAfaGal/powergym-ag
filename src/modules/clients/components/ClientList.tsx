import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Client } from "../queries";
import { ClientTable } from "./ClientTable";
import { ClientCards } from "./ClientCards";

export function ClientList({
  clients,
  hasFilters,
}: {
  clients: Client[];
  hasFilters: boolean;
}) {
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">
          {hasFilters
            ? "No hay clientes que coincidan con la búsqueda"
            : "Todavía no hay clientes registrados"}
        </p>
        {!hasFilters && (
          <Button
            render={<Link href="/clients/new" />}
            nativeButton={false}
            size="sm"
          >
            Registrar el primer cliente
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <ClientTable clients={clients} />
      <ClientCards clients={clients} />
    </>
  );
}

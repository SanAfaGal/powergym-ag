import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Client } from "../queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactLinks } from "./ContactLinks";

export function ClientCards({ clients }: { clients: Client[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {clients.map((client) => (
        // Not a single card-wide <Link>: ContactLinks renders tel:/wa.me
        // anchors, and an <a> nested inside another <a> is invalid HTML
        // (and breaks click targeting) -- only the name links out.
        <Card key={client.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/clients/${client.id}`}
              className="font-medium hover:underline"
            >
              {client.first_name} {client.last_name}
              {client.alias && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({client.alias})
                </span>
              )}
            </Link>
            <StatusBadge isActive={client.is_active} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {client.dni_number && (
              <span className="tabular-nums">
                {client.dni_type} {client.dni_number}
              </span>
            )}
            {client.phone && <ContactLinks phone={client.phone} />}
          </div>
        </Card>
      ))}
    </div>
  );
}

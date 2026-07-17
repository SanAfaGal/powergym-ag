import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { ClientWithSubscription } from "../queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SubscriptionStatusBadge } from "@/modules/subscriptions";
import { ContactLinks } from "./ContactLinks";
import { daysRemainingClass } from "../lib/daysRemainingClass";
import { GenderIcon } from "../lib/genderIcon";

export function ClientCards({
  clients,
}: {
  clients: ClientWithSubscription[];
}) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {clients.map((client) => (
        // Not a single card-wide <Link>: ContactLinks renders tel:/wa.me
        // anchors, and an <a> nested inside another <a> is invalid HTML
        // (and breaks click targeting) -- only the name links out.
        <Card key={client.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <GenderIcon gender={client.gender} />
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
            </div>
            <StatusBadge isActive={client.is_active} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {client.dni_number && (
              <span className="tabular-nums">
                {client.dni_type} {client.dni_number}
              </span>
            )}
            {client.phone && <ContactLinks phone={client.phone} />}
            {client.plan_name ? (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {client.plan_name}
                  {client.subscription_status && (
                    <SubscriptionStatusBadge
                      status={client.subscription_status}
                    />
                  )}
                </span>
                {client.days_remaining != null &&
                  client.days_remaining >= 0 &&
                  client.end_date && (
                    <span className="flex flex-col items-end gap-0.5">
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
                    </span>
                  )}
              </div>
            ) : (
              <span>Sin suscripción</span>
            )}
            {client.remaining != null && client.remaining > 0 && (
              <span className="tabular-nums">
                Saldo: ${client.remaining.toLocaleString("es-CO")}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

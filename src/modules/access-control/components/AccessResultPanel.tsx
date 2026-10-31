import { CircleCheckBigIcon, CircleXIcon } from "lucide-react";
import { SubscriptionStatusBadge } from "@/modules/subscriptions/components/SubscriptionStatusBadge";
import type { SubscriptionStatus } from "@/modules/subscriptions";
import type { AccessAttemptResult } from "../actions";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

export function AccessResultPanel({ result }: { result: AccessAttemptResult }) {
  const granted = result.decision === "granted";
  const { client } = result;

  return (
    <div
      role="status"
      className={`flex flex-col items-center gap-3 rounded-lg p-6 text-center ${
        granted ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      }`}
    >
      {granted ? (
        <CircleCheckBigIcon className="size-14" />
      ) : (
        <CircleXIcon className="size-14" />
      )}
      <p className="font-heading text-2xl font-bold">
        {granted ? "Acceso autorizado" : "Acceso denegado"}
      </p>
      {!granted && <p className="text-base">{result.message}</p>}

      {client ? (
        <div className="flex flex-col items-center gap-1.5 text-foreground">
          <p className="text-lg font-semibold">{client.fullName}</p>
          {client.alias && (
            <p className="text-sm text-muted-foreground">{client.alias}</p>
          )}
          <div className="flex items-center gap-2">
            {client.subscriptionStatus && (
              <SubscriptionStatusBadge
                status={client.subscriptionStatus as SubscriptionStatus}
              />
            )}
            {client.endDate && (
              <span className="text-sm text-muted-foreground">
                Vence el {formatDate(client.endDate)}
              </span>
            )}
          </div>
        </div>
      ) : (
        !granted && (
          <p className="text-sm text-foreground">Persona no identificada</p>
        )
      )}
    </div>
  );
}

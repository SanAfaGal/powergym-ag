import { CircleCheckBigIcon, CircleXIcon, ScanFaceIcon } from "lucide-react";
import { SubscriptionStatusBadge } from "@/modules/subscriptions/components/SubscriptionStatusBadge";
import type { SubscriptionStatus } from "@/modules/subscriptions";
import type { AccessAttemptResult } from "../actions";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

// Fills the space it is given: waiting state until a result arrives, then a
// large authorized/denied card the staff can read from a distance.
export function AccessResultPanel({
  result,
}: {
  result: AccessAttemptResult | null;
}) {
  if (!result) {
    return (
      <div className="flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <ScanFaceIcon className="size-16 text-muted-foreground/50" />
        <p className="text-xl font-semibold text-muted-foreground">
          Esperando a la siguiente persona
        </p>
        <p className="text-sm text-muted-foreground">
          El resultado del acceso aparece acá.
        </p>
      </div>
    );
  }

  const granted = result.decision === "granted";
  const { client } = result;

  return (
    <div
      role="status"
      className={`flex h-full min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border-2 p-8 text-center duration-300 animate-in fade-in zoom-in-95 ${
        granted
          ? "border-success/50 bg-success/10 text-success"
          : "border-destructive/50 bg-destructive/10 text-destructive"
      }`}
    >
      {granted ? (
        <CircleCheckBigIcon className="size-24" />
      ) : (
        <CircleXIcon className="size-24" />
      )}
      <p className="font-heading text-4xl font-bold tracking-tight">
        {granted ? "Acceso autorizado" : "Acceso denegado"}
      </p>
      {!granted && <p className="text-xl font-medium">{result.message}</p>}

      {client ? (
        <div className="flex flex-col items-center gap-2 text-foreground">
          <p className="text-3xl font-semibold">{client.fullName}</p>
          {client.alias && (
            <p className="text-base text-muted-foreground">{client.alias}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {client.subscriptionStatus && (
              <SubscriptionStatusBadge
                status={client.subscriptionStatus as SubscriptionStatus}
              />
            )}
            {client.endDate && (
              <span className="text-base text-muted-foreground">
                Vence el {formatDate(client.endDate)}
              </span>
            )}
          </div>
        </div>
      ) : (
        !granted && (
          <p className="text-lg text-foreground">Persona no identificada</p>
        )
      )}
    </div>
  );
}

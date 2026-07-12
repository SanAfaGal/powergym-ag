import { SubscriptionTable } from "./SubscriptionTable";
import { SubscriptionCards } from "./SubscriptionCards";
import type { GlobalSubscriptionRow } from "../queries";

export function SubscriptionList({
  subscriptions,
}: {
  subscriptions: GlobalSubscriptionRow[];
}) {
  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">No hay suscripciones para este filtro</p>
      </div>
    );
  }

  return (
    <>
      <SubscriptionTable subscriptions={subscriptions} />
      <SubscriptionCards subscriptions={subscriptions} />
    </>
  );
}

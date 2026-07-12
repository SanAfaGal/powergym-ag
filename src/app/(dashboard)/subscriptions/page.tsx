import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  listSubscriptions,
  SubscriptionList,
  SubscriptionFilters,
} from "@/modules/subscriptions";

const VALID_STATUSES = [
  "active",
  "pending_payment",
  "scheduled",
  "expired",
  "canceled",
];

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = VALID_STATUSES.includes(params.status ?? "")
    ? params.status
    : undefined;

  const subscriptions = await listSubscriptions({ status });

  return (
    <div>
      <PageHeader
        title="Suscripciones"
        description="Todas las suscripciones del gimnasio, con su estado y saldo pendiente."
      />
      <Card className="gap-0 py-0">
        <div className="border-b border-border p-4 sm:p-6">
          <SubscriptionFilters status={status ?? "all"} />
        </div>
        <div className="p-4 sm:p-6">
          <SubscriptionList subscriptions={subscriptions} />
        </div>
      </Card>
    </div>
  );
}

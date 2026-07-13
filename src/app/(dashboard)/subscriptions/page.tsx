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
      <div className="mb-4">
        <SubscriptionFilters status={status ?? "all"} />
      </div>
      <SubscriptionList subscriptions={subscriptions} />
    </div>
  );
}

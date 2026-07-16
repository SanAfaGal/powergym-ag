import { PageHeader } from "@/components/layout/PageHeader";
import {
  listSubscriptions,
  SubscriptionList,
  SubscriptionFilters,
  Pager,
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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = VALID_STATUSES.includes(params.status ?? "")
    ? params.status
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const {
    subscriptions,
    total,
    pageSize,
  } = await listSubscriptions({ status, page });

  function buildHref(targetPage: number) {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return qs ? `/subscriptions?${qs}` : "/subscriptions";
  }

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
      <div className="mt-4">
        <Pager
          page={page}
          total={total}
          pageSize={pageSize}
          buildHref={buildHref}
          itemLabel="suscripciones"
        />
      </div>
    </div>
  );
}

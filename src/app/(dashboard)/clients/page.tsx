import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  listClients,
  ClientList,
  ClientFilters,
  ClientIndicators,
  Pager,
  type SortOption,
} from "@/modules/clients";
import { listActivePlansWithPrice, type SubscriptionStatus } from "@/modules/subscriptions";
import { getDashboardStats } from "@/modules/dashboard";
import { bogotaToday } from "@/lib/date/bogota";

const VALID_SUBSCRIPTION_STATUSES = [
  "active",
  "pending_payment",
  "scheduled",
  "expired",
  "canceled",
  "none",
];
const VALID_SORTS: SortOption[] = ["days_remaining_asc", "days_remaining_desc"];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    subscriptionStatus?: string;
    planId?: string;
    hasBalance?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";
  const subscriptionStatus = VALID_SUBSCRIPTION_STATUSES.includes(
    params.subscriptionStatus ?? ""
  )
    ? (params.subscriptionStatus as SubscriptionStatus | "none")
    : "all";
  const planId = params.planId ?? "";
  const hasBalance = params.hasBalance === "yes";
  const sort = VALID_SORTS.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : "days_remaining_asc";
  const page = Math.max(1, Number(params.page) || 1);

  const today = bogotaToday();
  const [{ clients, total, pageSize }, plans, stats] = await Promise.all([
    listClients({
      q,
      status,
      subscriptionStatus,
      planId: planId || undefined,
      hasBalance,
      sort,
      page,
    }),
    listActivePlansWithPrice(),
    getDashboardStats(`${today.slice(0, 7)}-01`, today),
  ]);

  function buildHref(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    if (subscriptionStatus !== "all")
      p.set("subscriptionStatus", subscriptionStatus);
    if (planId) p.set("planId", planId);
    if (hasBalance) p.set("hasBalance", "yes");
    if (sort !== "days_remaining_asc") p.set("sort", sort);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return qs ? `/clients?${qs}` : "/clients";
  }

  const hasFilters =
    Boolean(q) ||
    status !== "all" ||
    subscriptionStatus !== "all" ||
    Boolean(planId) ||
    hasBalance;

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Buscá, registrá y gestioná los clientes del gimnasio y sus suscripciones."
        actions={
          <Button render={<Link href="/clients/new" />} nativeButton={false}>
            Nuevo cliente
          </Button>
        }
      />

      <div className="mb-6">
        <ClientIndicators stats={stats} />
      </div>

      <div className="mb-4">
        <ClientFilters
          defaultQuery={q}
          status={status}
          subscriptionStatus={subscriptionStatus}
          planId={planId}
          hasBalance={hasBalance}
          sort={sort}
          plans={plans}
        />
      </div>

      <ClientList clients={clients} hasFilters={hasFilters} />

      <div className="mt-4">
        <Pager
          page={page}
          total={total}
          pageSize={pageSize}
          buildHref={buildHref}
          itemLabel="clientes"
        />
      </div>
    </div>
  );
}

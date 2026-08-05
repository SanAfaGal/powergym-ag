import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { bogotaToday } from "@/lib/date/bogota";
import {
  listClients,
  listExpiringClients,
  ClientList,
  ClientFilters,
  CopyExpiringButton,
  formatExpiringClientsSummary,
  CopyRenewalRemindersButton,
  formatRenewalRemindersExcel,
  Pager,
  type SortOption,
} from "@/modules/clients";
import { listActivePlansWithPrice, type SubscriptionStatus } from "@/modules/subscriptions";

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
    expiresFrom?: string;
    expiresTo?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const status =
    params.status === "active" ||
    params.status === "inactive" ||
    params.status === "all"
      ? params.status
      : "active";
  const subscriptionStatus = VALID_SUBSCRIPTION_STATUSES.includes(
    params.subscriptionStatus ?? ""
  )
    ? (params.subscriptionStatus as SubscriptionStatus | "none")
    : "all";
  const planId = params.planId ?? "";
  const hasBalance = params.hasBalance === "yes";
  const expiresFrom = params.expiresFrom ?? "";
  const expiresTo = params.expiresTo ?? "";
  const isExpiringFilterActive = Boolean(expiresFrom && expiresTo);
  const sort = VALID_SORTS.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : "days_remaining_asc";
  const page = Math.max(1, Number(params.page) || 1);
  const today = bogotaToday();

  const [{ clients, total, pageSize }, plans, expiringClients] =
    await Promise.all([
      listClients({
        q,
        status,
        subscriptionStatus,
        planId: planId || undefined,
        hasBalance,
        expiresFrom: isExpiringFilterActive ? expiresFrom : undefined,
        expiresTo: isExpiringFilterActive ? expiresTo : undefined,
        sort,
        page,
      }),
      listActivePlansWithPrice(),
      isExpiringFilterActive
        ? listExpiringClients(expiresFrom, expiresTo, {
            q,
            status,
            planId: planId || undefined,
            hasBalance,
          })
        : Promise.resolve([]),
    ]);

  function buildHref(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "active") p.set("status", status);
    if (subscriptionStatus !== "all")
      p.set("subscriptionStatus", subscriptionStatus);
    if (planId) p.set("planId", planId);
    if (hasBalance) p.set("hasBalance", "yes");
    if (isExpiringFilterActive) {
      p.set("expiresFrom", expiresFrom);
      p.set("expiresTo", expiresTo);
    }
    if (sort !== "days_remaining_asc") p.set("sort", sort);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return qs ? `/clients?${qs}` : "/clients";
  }

  const hasFilters =
    Boolean(q) ||
    status !== "active" ||
    subscriptionStatus !== "all" ||
    Boolean(planId) ||
    hasBalance ||
    isExpiringFilterActive;

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

      <div className="mb-4">
        <ClientFilters
          defaultQuery={q}
          status={status}
          subscriptionStatus={subscriptionStatus}
          planId={planId}
          hasBalance={hasBalance}
          expiresFrom={expiresFrom}
          expiresTo={expiresTo}
          sort={sort}
          plans={plans}
        />
      </div>

      {isExpiringFilterActive && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-secondary/30 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Recordatorios de vencimiento</p>
            <p className="text-xs text-muted-foreground">
              Copiá la lista para revisar quién vence, o exportá teléfono y
              mensaje listos para pegar en Excel y enviar por WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyExpiringButton
              text={formatExpiringClientsSummary(
                expiresFrom,
                expiresTo,
                expiringClients
              )}
              count={expiringClients.length}
            />
            <CopyRenewalRemindersButton
              text={formatRenewalRemindersExcel(expiringClients, today)}
              count={expiringClients.length}
            />
          </div>
        </div>
      )}

      <ClientList clients={clients} hasFilters={hasFilters} today={today} />

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

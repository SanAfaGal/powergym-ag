import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/session";
import {
  getDashboardStats,
  DashboardFilters,
  KpiSection,
  SubscriptionStatusSection,
  RevenueSection,
  DebtorsSection,
  ExpiringSoonSection,
  KpiSkeleton,
  CardListSkeleton,
} from "@/modules/dashboard";
import { bogotaToday } from "@/lib/date/bogota";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const today = bogotaToday();
  const start = params.start ?? `${today.slice(0, 7)}-01`;
  const end = params.end ?? today;

  const auth = await getAuthContext();
  const isAdmin = auth?.profile.role === "admin";

  // Started once, un-awaited, and shared by every section below that needs
  // it (KpiSection, SubscriptionStatusSection, RevenueSection) -- each
  // awaits the same promise instance, so get_dashboard_stats runs once per
  // request no matter how many sections read from it, while every section
  // still streams in independently via its own Suspense boundary.
  const statsPromise = getDashboardStats(start, end);

  return (
    <div>
      <PageHeader
        title="Panel"
        description="Estadísticas del gimnasio y estado de clientes."
      />

      <div className="mb-6">
        <DashboardFilters start={start} end={end} />
      </div>

      <div className="flex flex-col gap-6">
        <Suspense fallback={<KpiSkeleton />}>
          <KpiSection statsPromise={statsPromise} />
        </Suspense>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Suspense
            fallback={<CardListSkeleton title="Suscripciones por estado" />}
          >
            <SubscriptionStatusSection statsPromise={statsPromise} />
          </Suspense>
          <Suspense
            fallback={<CardListSkeleton title="Ingresos por método de pago" />}
          >
            <RevenueSection
              statsPromise={statsPromise}
              start={start}
              end={end}
              isAdmin={Boolean(isAdmin)}
            />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <CardListSkeleton title="Clientes con saldo pendiente" />
          }
        >
          <DebtorsSection />
        </Suspense>

        <Suspense
          fallback={
            <CardListSkeleton title="Suscripciones por vencer (próximos 7 días)" />
          }
        >
          <ExpiringSoonSection />
        </Suspense>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardListSkeleton } from "@/modules/dashboard";
import {
  getOpenDoubts,
  getTodayActivity,
  OpenDoubtsCard,
  TodayActivityView,
  TodayFilter,
} from "@/modules/activity";
import { bogotaToday } from "@/lib/date/bogota";

async function TodaySection({ date }: { date: string }) {
  const activity = await getTodayActivity(date);
  return <TodayActivityView activity={activity} />;
}

async function DoubtsSection() {
  const doubts = await getOpenDoubts();
  return <OpenDoubtsCard doubts={doubts} />;
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? bogotaToday();

  return (
    <div>
      <PageHeader
        title="Hoy"
        description="Todo lo registrado en el día, por WhatsApp y por el panel."
      />
      <div className="mb-6">
        <TodayFilter date={date} />
      </div>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<CardListSkeleton title="Dudas abiertas" rows={3} />}>
          <DoubtsSection />
        </Suspense>
        <Suspense fallback={<CardListSkeleton title="Pagos" rows={6} />}>
          <TodaySection date={date} />
        </Suspense>
      </div>
    </div>
  );
}

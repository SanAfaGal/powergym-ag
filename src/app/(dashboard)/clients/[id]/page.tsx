import { notFound } from "next/navigation";
import {
  CalendarCheckIcon,
  CreditCardIcon,
  ScanFaceIcon,
  UserRoundIcon,
} from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { UrlTabs } from "@/components/shared/UrlTabs";
import {
  getClient,
  listDocumentTypes,
  listGenderTypes,
  ClientHeader,
  ClientDetails,
  type HeaderChip,
} from "@/modules/clients";
import {
  listClientSubscriptions,
  listActivePlansWithPrice,
  listPaymentTypes,
  SubscriptionsSection,
} from "@/modules/subscriptions";
import { listBankAccounts } from "@/modules/bank-accounts";
import { getAuthContext } from "@/lib/auth/session";
import { bogotaToday } from "@/lib/date/bogota";
import {
  getClientAttendance,
  getEnrollmentStatus,
  getClientPhotoUrl,
  listAccessEvents,
  ClientAttendanceCard,
  FaceEnrollmentCard,
} from "@/modules/access-control";

const DAY_MS = 86_400_000;

function membershipChip(
  subscriptions: { status: string; end_date: string; plan_name: string }[],
  today: string,
): HeaderChip {
  const current = subscriptions
    .filter((s) => s.status === "active")
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
  if (current) {
    const left = Math.round(
      (Date.parse(`${current.end_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
        DAY_MS,
    );
    const until = new Date(`${current.end_date}T12:00:00Z`).toLocaleDateString("es-CO", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
    return {
      text: `${current.plan_name} · hasta ${until}`,
      tone: left <= 7 ? "warning" : "success",
    };
  }
  if (subscriptions.some((s) => s.status === "pending_payment")) {
    return { text: "Pago pendiente", tone: "warning" };
  }
  return { text: "Sin membresía vigente", tone: "muted" };
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const [
    client,
    documentTypes,
    genderTypes,
    subscriptions,
    plans,
    paymentTypes,
    allBankAccounts,
    enrollmentStatus,
    photoUrl,
    attendance,
    recentEntries,
    auth,
  ] = await Promise.all([
    getClient(id).catch(() => null),
    listDocumentTypes(),
    listGenderTypes(),
    listClientSubscriptions(id),
    listActivePlansWithPrice(),
    listPaymentTypes(),
    listBankAccounts(),
    getEnrollmentStatus(id),
    getClientPhotoUrl(id),
    getClientAttendance(id),
    listAccessEvents({ clientId: id, result: "granted", pageSize: 8 }),
    getAuthContext(),
  ]);

  if (!client) notFound();

  const activeBankAccounts = allBankAccounts.filter((a) => a.is_active);
  const today = bogotaToday();
  const chips: HeaderChip[] = [
    membershipChip(subscriptions, today),
    enrollmentStatus.hasTemplate
      ? { text: "Rostro registrado", tone: "success" }
      : { text: "Sin rostro", tone: "muted" },
  ];

  return (
    <>
      <BackLink href="/clients" label="Clientes" />
      <div className="flex flex-col gap-6">
        <ClientHeader
          client={client}
          photoUrl={photoUrl}
          chips={chips}
        />

        <UrlTabs
          initial={tab ?? "memberships"}
          tabs={[
            {
              value: "memberships",
              label: "Membresías",
              icon: <CreditCardIcon />,
              content: (
                <SubscriptionsSection
                  clientId={client.id}
                  subscriptions={subscriptions}
                  plans={plans}
                  paymentTypes={paymentTypes}
                  bankAccounts={activeBankAccounts}
                  allBankAccounts={allBankAccounts}
                />
              ),
            },
            {
              value: "info",
              label: "Información",
              icon: <UserRoundIcon />,
              content: (
                <ClientDetails
                  client={client}
                  documentTypes={documentTypes}
                  genderTypes={genderTypes}
                />
              ),
            },
            {
              value: "face",
              label: "Rostro",
              icon: <ScanFaceIcon />,
              content: (
                <FaceEnrollmentCard
                  clientId={client.id}
                  clientName={`${client.first_name} ${client.last_name}`}
                  isAdmin={auth?.profile.role === "admin"}
                  status={enrollmentStatus}
                />
              ),
            },
            {
              value: "attendance",
              label: "Asistencia",
              icon: <CalendarCheckIcon />,
              content: (
                <ClientAttendanceCard
                  summary={attendance}
                  today={today}
                  recent={recentEntries.events.map((e) => ({
                    id: e.id,
                    occurredAt: e.occurredAt,
                    deviceLabel: e.deviceLabel,
                  }))}
                />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

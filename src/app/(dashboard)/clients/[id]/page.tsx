import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import {
  getClient,
  listDocumentTypes,
  listGenderTypes,
  ClientInfoSidebar,
} from "@/modules/clients";
import {
  listClientSubscriptions,
  listActivePlansWithPrice,
  listPaymentTypes,
  SubscriptionsSection,
} from "@/modules/subscriptions";
import { listBankAccounts } from "@/modules/bank-accounts";
import { getAuthContext } from "@/lib/auth/session";
import {
  getClientAttendance,
  getEnrollmentStatus,
  ClientAttendanceCard,
  FaceEnrollmentCard,
} from "@/modules/access-control";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    client,
    documentTypes,
    genderTypes,
    subscriptions,
    plans,
    paymentTypes,
    allBankAccounts,
    enrollmentStatus,
    attendance,
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
    getClientAttendance(id),
    getAuthContext(),
  ]);

  if (!client) notFound();

  const activeBankAccounts = allBankAccounts.filter((a) => a.is_active);

  return (
    <>
      <BackLink href="/clients" label="Clientes" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <div className="space-y-6">
          <ClientInfoSidebar
            client={client}
            documentTypes={documentTypes}
            genderTypes={genderTypes}
          />
          <ClientAttendanceCard summary={attendance} />
          <FaceEnrollmentCard
            clientId={client.id}
            clientName={`${client.first_name} ${client.last_name}`}
            isAdmin={auth?.profile.role === "admin"}
            status={enrollmentStatus}
          />
        </div>

        <div>
          <SubscriptionsSection
            clientId={client.id}
            subscriptions={subscriptions}
            plans={plans}
            paymentTypes={paymentTypes}
            bankAccounts={activeBankAccounts}
            allBankAccounts={allBankAccounts}
          />
        </div>
      </div>
    </>
  );
}

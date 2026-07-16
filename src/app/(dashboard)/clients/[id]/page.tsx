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
import { listActiveBankAccounts, listBankAccounts } from "@/modules/bank-accounts";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let client;
  try {
    client = await getClient(id);
  } catch {
    notFound();
  }

  const [
    documentTypes,
    genderTypes,
    subscriptions,
    plans,
    paymentTypes,
    activeBankAccounts,
    allBankAccounts,
  ] = await Promise.all([
    listDocumentTypes(),
    listGenderTypes(),
    listClientSubscriptions(id),
    listActivePlansWithPrice(),
    listPaymentTypes(),
    listActiveBankAccounts(),
    listBankAccounts(),
  ]);

  return (
    <>
      <BackLink href="/clients" label="Clientes" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <ClientInfoSidebar
          client={client}
          documentTypes={documentTypes}
          genderTypes={genderTypes}
        />

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

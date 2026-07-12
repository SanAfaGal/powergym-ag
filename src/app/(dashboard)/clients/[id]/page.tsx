import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  getClient,
  listDocumentTypes,
  listGenderTypes,
  StatusBadge,
  ContactLinks,
  EditClientDialog,
  DeactivateClientDialog,
} from "@/modules/clients";
import {
  listClientSubscriptions,
  listActivePlansWithPrice,
  listPaymentTypes,
  SubscriptionsSection,
} from "@/modules/subscriptions";
import { listActiveBankAccounts } from "@/modules/bank-accounts";

function calculateAge(birthDate: string) {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

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

  const [documentTypes, genderTypes, subscriptions, plans, paymentTypes, bankAccounts] =
    await Promise.all([
      listDocumentTypes(),
      listGenderTypes(),
      listClientSubscriptions(id),
      listActivePlansWithPrice(),
      listPaymentTypes(),
      listActiveBankAccounts(),
    ]);

  const documentTypeName = client.dni_type
    ? (documentTypes.find((d) => d.code === client.dni_type)?.name ??
      client.dni_type)
    : null;
  const genderName = client.gender
    ? (genderTypes.find((g) => g.code === client.gender)?.name ?? client.gender)
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {client.first_name} {client.last_name}
            {client.alias && (
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                ({client.alias})
              </span>
            )}
          </h1>
          <div className="mt-2">
            <StatusBadge isActive={client.is_active} />
          </div>
        </div>
        <div className="flex gap-2">
          <EditClientDialog
            client={client}
            documentTypes={documentTypes}
            genderTypes={genderTypes}
          />
          <DeactivateClientDialog
            clientId={client.id}
            clientName={`${client.first_name} ${client.last_name}`}
            isActive={client.is_active}
          />
        </div>
      </div>

      <Card className="max-w-2xl p-4 sm:p-6">
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field
          label="Documento"
          value={
            client.dni_number
              ? `${documentTypeName ?? ""} ${client.dni_number}`.trim()
              : null
          }
        />
        <Field label="Correo" value={client.email} />
        <Field
          label="Teléfono"
          value={client.phone ? <ContactLinks phone={client.phone} /> : null}
        />
        <Field label="Teléfono alternativo" value={client.alternative_phone} />
        <Field
          label="Fecha de nacimiento"
          value={
            client.birth_date
              ? `${new Date(client.birth_date).toLocaleDateString("es-CO")} (${calculateAge(client.birth_date)} años)`
              : null
          }
        />
        <Field label="Género" value={genderName} />
        <Field label="Dirección" value={client.address} />
        <Field
          label="Cliente desde"
          value={new Date(client.created_at).toLocaleDateString("es-CO")}
        />
        </dl>
      </Card>

      <SubscriptionsSection
        clientId={client.id}
        subscriptions={subscriptions}
        plans={plans}
        paymentTypes={paymentTypes}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}

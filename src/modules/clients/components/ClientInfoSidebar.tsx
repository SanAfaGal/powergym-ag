import {
  StatusBadge,
  ContactLinks,
  EditClientDialog,
  DeactivateClientDialog,
  type Client,
  type CatalogEntry,
} from "@/modules/clients";

function calculateAge(birthDate: string) {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export function ClientInfoSidebar({
  client,
  documentTypes,
  genderTypes,
}: {
  client: Client;
  documentTypes: CatalogEntry[];
  genderTypes: CatalogEntry[];
}) {
  const documentTypeName = client.dni_type
    ? (documentTypes.find((d) => d.code === client.dni_type)?.name ??
      client.dni_type)
    : null;
  const genderName = client.gender
    ? (genderTypes.find((g) => g.code === client.gender)?.name ??
      client.gender)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">
          {client.first_name} {client.last_name}
        </h1>
        {client.alias && (
          <p className="text-sm text-muted-foreground">({client.alias})</p>
        )}
        <div className="mt-2">
          <StatusBadge isActive={client.is_active} />
        </div>
      </div>

      <dl className="flex flex-col gap-4">
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
        <Field
          label="Teléfono alternativo"
          value={client.alternative_phone}
        />
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
        <Field
          label="Última actualización"
          value={formatDateTime(client.updated_at)}
        />
      </dl>

      <div className="flex flex-col gap-2">
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
  );
}

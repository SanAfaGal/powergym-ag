import type { Client, CatalogEntry } from "../queries";
import { ContactLinks } from "./ContactLinks";
import { EditClientDialog } from "./EditClientDialog";

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

type Field = { label: string; value: React.ReactNode | null };

// Only the fields that have a value are shown; the rest are listed at the
// bottom as "Sin registrar", so a row of dashes does not take the space.
function Group({ title, fields }: { title: string; fields: Field[] }) {
  const filled = fields.filter((f) => f.value);
  if (filled.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 font-heading text-base font-semibold">{title}</h2>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {filled.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="break-words text-sm font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ClientDetails({
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

  const contact: Field[] = [
    {
      label: "Documento",
      value: client.dni_number
        ? `${documentTypeName ?? ""} ${client.dni_number}`.trim()
        : null,
    },
    { label: "Correo", value: client.email },
    {
      label: "Teléfono",
      value: client.phone ? <ContactLinks phone={client.phone} /> : null,
    },
    { label: "Teléfono alternativo", value: client.alternative_phone },
  ];
  const personal: Field[] = [
    {
      label: "Fecha de nacimiento",
      value: client.birth_date
        ? `${new Date(client.birth_date).toLocaleDateString("es-CO")} (${calculateAge(client.birth_date)} años)`
        : null,
    },
    { label: "Género", value: genderName },
    { label: "Dirección", value: client.address },
  ];
  const missing = [...contact, ...personal]
    .filter((f) => !f.value)
    .map((f) => f.label);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-end gap-1.5">
        <EditClientDialog
          client={client}
          documentTypes={documentTypes}
          genderTypes={genderTypes}
        />
        <p className="text-right text-xs leading-relaxed text-muted-foreground">
          Cliente desde {new Date(client.created_at).toLocaleDateString("es-CO")}
          <br />
          Actualizado {formatDateTime(client.updated_at)}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Group title="Contacto" fields={contact} />
        <Group title="Personal" fields={personal} />
      </div>

      {missing.length > 0 && (
        <p className="px-1 text-sm text-muted-foreground">
          <span className="font-medium">Sin registrar:</span> {missing.join(", ")}.
          Se completan con Editar.
        </p>
      )}
    </div>
  );
}

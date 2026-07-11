import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  ClientForm,
  createClient,
  listDocumentTypes,
  listGenderTypes,
} from "@/modules/clients";

export default async function NewClientPage() {
  const [documentTypes, genderTypes] = await Promise.all([
    listDocumentTypes(),
    listGenderTypes(),
  ]);

  return (
    <div>
      <PageHeader title="Nuevo cliente" description="Registrar un cliente nuevo" />
      <Card className="max-w-2xl p-4 sm:p-6">
        <ClientForm
          documentTypes={documentTypes}
          genderTypes={genderTypes}
          onSubmit={createClient}
          submitLabel="Registrar cliente"
        />
      </Card>
    </div>
  );
}

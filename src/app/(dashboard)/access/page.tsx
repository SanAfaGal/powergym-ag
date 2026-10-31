import { PageHeader } from "@/components/layout/PageHeader";
import { AccessKiosk, getAccessSettings } from "@/modules/access-control";

export default async function AccessPage() {
  const settings = await getAccessSettings();

  return (
    <div>
      <PageHeader
        title="Control de acceso"
        description="Verificación facial para el ingreso al gimnasio. Prototipo: la barrera es simulada."
      />
      <AccessKiosk livenessRequired={settings.livenessRequired} />
    </div>
  );
}

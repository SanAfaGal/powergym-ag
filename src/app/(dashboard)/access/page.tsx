import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccessKiosk, getAccessSettings } from "@/modules/access-control";

export default async function AccessPage() {
  const settings = await getAccessSettings();

  return (
    <div>
      <PageHeader
        title="Control de acceso"
        description="Verificación facial para el ingreso al gimnasio. Prototipo: la barrera es simulada."
        actions={
          <Button
            variant="outline"
            render={<Link href="/access/events" />}
            nativeButton={false}
          >
            Ver intentos
          </Button>
        }
      />
      <AccessKiosk livenessRequired={settings.livenessRequired} />
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/session";
import { AccessKiosk, getAccessSettings } from "@/modules/access-control";

export default async function AccessPage() {
  const [settings, auth] = await Promise.all([
    getAccessSettings(),
    getAuthContext(),
  ]);
  const isAdmin = auth?.profile.role === "admin";

  return (
    <div>
      <PageHeader
        title="Control de acceso"
        description="Verificación facial para el ingreso al gimnasio. Prototipo: la barrera es simulada."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/access/events" />}
              nativeButton={false}
            >
              Ver intentos
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                render={<Link href="/access/settings" />}
                nativeButton={false}
              >
                Configuración
              </Button>
            )}
          </>
        }
      />
      <AccessKiosk
        livenessRequired={settings.livenessRequired}
        challenges={settings.livenessChallenges}
      />
    </div>
  );
}

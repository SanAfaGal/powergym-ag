import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/session";
import {
  AccessBackLink,
  AccessSettingsForm,
  getAccessSettings,
} from "@/modules/access-control";

export default async function AccessSettingsPage() {
  const auth = await getAuthContext();
  if (auth?.profile.role !== "admin") redirect("/access");

  const settings = await getAccessSettings();

  return (
    <div>
      <AccessBackLink />
      <PageHeader
        title="Configuración del acceso"
        description="Umbral de reconocimiento y pruebas de vida del kiosco."
      />
      <AccessSettingsForm settings={settings} />
    </div>
  );
}

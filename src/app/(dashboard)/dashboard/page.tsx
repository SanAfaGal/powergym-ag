import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  return (
    <PageHeader
      title={`Bienvenido, ${profile?.full_name}`}
      description="El dashboard con estadísticas llega en una fase siguiente."
    />
  );
}

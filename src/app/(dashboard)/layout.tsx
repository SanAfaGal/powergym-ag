import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth on top of src/middleware.ts -- should be unreachable.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar
        fullName={profile.full_name}
        isAdmin={profile.role === "admin"}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1 bg-secondary/50">
          <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
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
  const auth = await getAuthContext();

  // Defense in depth on top of src/middleware.ts -- should be unreachable.
  if (!auth) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar
        fullName={auth.profile.full_name}
        isAdmin={auth.profile.role === "admin"}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

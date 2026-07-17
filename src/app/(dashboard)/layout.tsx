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

  // getAuthContext trusts the profile src/proxy.ts already validated and
  // forwarded via header for this request -- should be unreachable in
  // normal operation. Falls back to an independent check only for requests
  // that somehow reached here without going through middleware, so this
  // redirect is the backstop for that fallback failing, not a routine
  // re-validation.
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

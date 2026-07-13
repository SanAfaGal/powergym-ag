"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  Receipt,
  Sun,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { signOut } from "@/modules/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/plans", label: "Planes", icon: CreditCard },
  { href: "/subscriptions", label: "Suscripciones", icon: Receipt },
];

const ADMIN_NAV_LINKS = [
  {
    href: "/bank-accounts",
    label: "Cuentas bancarias",
    icon: Landmark,
  },
  {
    href: "/staff",
    label: "Staff",
    icon: UserCog,
  },
];

export function AppSidebar({
  fullName,
  isAdmin,
}: {
  fullName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const links = isAdmin ? [...NAV_LINKS, ...ADMIN_NAV_LINKS] : NAV_LINKS;
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex h-8 items-center justify-between group-data-[collapsible=icon]:justify-center">
          <span className="font-heading text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            POWER<span className="text-primary">GYM</span>
          </span>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-3">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);
                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      render={<Link href={link.href} />}
                      isActive={isActive}
                      tooltip={link.label}
                    >
                      <link.icon />
                      <span>{link.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex flex-col gap-2 px-1 py-1">
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {fullName}
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              {isAdmin ? "Administrador" : "Empleado"}
            </span>
          </div>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Cambiar tema claro u oscuro"
              className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Sun className="dark:hidden" />
              <Moon className="hidden dark:block" />
            </Button>
            <form action={signOut} className="flex-1 group-data-[collapsible=icon]:w-full">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:p-0"
                aria-label="Cerrar sesión"
              >
                <LogOut />
                <span className="group-data-[collapsible=icon]:hidden">
                  Cerrar sesión
                </span>
              </Button>
            </form>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

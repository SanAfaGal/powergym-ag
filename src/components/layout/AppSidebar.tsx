"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  Receipt,
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
} from "@/components/ui/sidebar";
import { signOut } from "@/modules/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/plans", label: "Planes", icon: CreditCard },
  { href: "/subscriptions", label: "Suscripciones", icon: Receipt },
];

const ADMIN_NAV_LINK = {
  href: "/bank-accounts",
  label: "Cuentas bancarias",
  icon: Landmark,
};

export function AppSidebar({
  fullName,
  isAdmin,
}: {
  fullName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const links = isAdmin ? [...NAV_LINKS, ADMIN_NAV_LINK] : NAV_LINKS;

  return (
    <Sidebar>
      <SidebarHeader>
        <span className="flex h-8 items-center px-2 font-heading text-lg font-bold tracking-tight">
          POWER<span className="text-primary">GYM</span>
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
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
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <span className="truncate text-sm text-sidebar-foreground/70">
            {fullName}
          </span>
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

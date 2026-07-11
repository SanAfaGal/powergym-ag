import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/modules/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/clients", label: "Clientes" },
  { href: "/plans", label: "Planes" },
];

export function Topbar({ fullName }: { fullName: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
      <div className="flex items-center gap-6">
        <span className="font-heading text-lg font-bold tracking-tight">
          POWER<span className="text-primary">GYM</span>
        </span>
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-sidebar-foreground/70 sm:inline">
          {fullName}
        </span>
        <form action={signOut}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Cerrar sesión
          </Button>
        </form>
      </div>
    </header>
  );
}

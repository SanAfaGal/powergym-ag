"use client";

import { useFormStatus } from "react-dom";
import { LogOut, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Must render as a child of the <form action={signOut}> -- useFormStatus
// only picks up pending state from the nearest ancestor form.
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
      aria-label="Cerrar sesión"
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <LogOut />}
      <span className="group-data-[collapsible=icon]:hidden">
        Cerrar sesión
      </span>
    </Button>
  );
}

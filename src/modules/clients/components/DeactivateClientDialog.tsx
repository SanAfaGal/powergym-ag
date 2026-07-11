"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setClientActive } from "../actions";

export function DeactivateClientDialog({
  clientId,
  clientName,
  isActive,
}: {
  clientId: string;
  clientName: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await setClientActive(clientId, !isActive);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={isActive ? "destructive" : "outline"} size="sm" />}
      >
        {isActive ? "Desactivar" : "Reactivar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Desactivar cliente" : "Reactivar cliente"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `${clientName} no va a aparecer como cliente activo. Podés reactivarlo cuando quieras.`
              : `${clientName} vuelve a aparecer como cliente activo.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant={isActive ? "destructive" : "default"}
            onClick={confirm}
            disabled={isPending}
          >
            {isPending
              ? "Guardando..."
              : isActive
                ? "Desactivar"
                : "Reactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/SubmitButton";
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
      try {
        await setClientActive(clientId, !isActive);
      } catch {
        toast.error(
          isActive ? "No se pudo desactivar el cliente" : "No se pudo reactivar el cliente"
        );
        return;
      }
      toast.success(isActive ? "Cliente desactivado" : "Cliente reactivado");
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
          <SubmitButton
            type="button"
            variant={isActive ? "destructive" : "default"}
            onClick={confirm}
            pending={isPending}
            pendingLabel="Guardando..."
          >
            {isActive ? "Desactivar" : "Reactivar"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

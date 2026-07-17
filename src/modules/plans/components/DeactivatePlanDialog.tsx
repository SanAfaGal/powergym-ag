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
import { setPlanActive } from "../actions";

export function DeactivatePlanDialog({
  planId,
  planName,
  isActive,
}: {
  planId: string;
  planName: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      try {
        await setPlanActive(planId, !isActive);
      } catch {
        toast.error(
          isActive ? "No se pudo desactivar el plan" : "No se pudo reactivar el plan"
        );
        return;
      }
      toast.success(isActive ? "Plan desactivado" : "Plan reactivado");
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
            {isActive ? "Desactivar plan" : "Reactivar plan"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `${planName} deja de estar disponible para nuevas suscripciones. Las suscripciones existentes no se ven afectadas.`
              : `${planName} vuelve a estar disponible para nuevas suscripciones.`}
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

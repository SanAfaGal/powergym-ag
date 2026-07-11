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
      await setPlanActive(planId, !isActive);
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

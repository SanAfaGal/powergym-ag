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
import { setBankAccountActive } from "../actions";

export function DeactivateBankAccountDialog({
  accountId,
  accountLabel,
  isActive,
}: {
  accountId: string;
  accountLabel: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await setBankAccountActive(accountId, !isActive);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isActive ? "destructive" : "outline"} size="sm" />
        }
      >
        {isActive ? "Desactivar" : "Reactivar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Desactivar cuenta" : "Reactivar cuenta"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `${accountLabel} deja de estar disponible para registrar nuevos pagos.`
              : `${accountLabel} vuelve a estar disponible para registrar pagos.`}
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

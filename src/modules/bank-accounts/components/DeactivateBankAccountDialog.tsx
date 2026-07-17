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
      try {
        await setBankAccountActive(accountId, !isActive);
      } catch {
        toast.error(
          isActive ? "No se pudo desactivar la cuenta" : "No se pudo reactivar la cuenta"
        );
        return;
      }
      toast.success(isActive ? "Cuenta desactivada" : "Cuenta reactivada");
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

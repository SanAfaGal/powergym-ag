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
import { setStaffActive } from "../actions";

export function DeactivateStaffDialog({
  staffId,
  staffName,
  isActive,
  disabled = false,
  disabledTitle,
}: {
  staffId: string;
  staffName: string;
  isActive: boolean;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function confirm() {
    setServerError(null);
    startTransition(async () => {
      const result = await setStaffActive(staffId, !isActive);
      if (!result.success) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setServerError(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={isActive ? "destructive" : "outline"}
            size="sm"
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
          />
        }
      >
        {isActive ? "Desactivar" : "Activar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Desactivar usuario" : "Activar usuario"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `${staffName} perderá acceso para iniciar sesión en el sistema.`
              : `${staffName} volverá a tener acceso para iniciar sesión en el sistema.`}
          </DialogDescription>
        </DialogHeader>
        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant={isActive ? "destructive" : "default"}
            onClick={confirm}
            disabled={isPending}
          >
            {isPending ? "Guardando..." : isActive ? "Desactivar" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

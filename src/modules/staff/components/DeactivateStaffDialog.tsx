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
}: {
  staffId: string;
  staffName: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await setStaffActive(staffId, !isActive);
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

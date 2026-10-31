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
import { deleteFaceTemplate } from "../actions";

export function DeleteFaceTemplateDialog({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteFaceTemplate(clientId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Registro facial eliminado");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        Eliminar registro facial
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar registro facial</DialogTitle>
          <DialogDescription>
            Se borra de forma definitiva el registro facial de {clientName} y
            se revoca su consentimiento. Para volver a usar el acceso facial
            hará falta un consentimiento nuevo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <SubmitButton
            type="button"
            variant="destructive"
            onClick={confirm}
            pending={isPending}
            pendingLabel="Eliminando..."
          >
            Eliminar
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

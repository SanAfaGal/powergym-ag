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
import { cancelScheduledPrice } from "../actions";

export function CancelScheduledPriceDialog({
  planId,
  priceId,
}: {
  planId: string;
  priceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelScheduledPrice(planId, priceId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Programación cancelada");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Cancelar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar precio programado</DialogTitle>
          <DialogDescription>
            Se elimina esta programación. El precio vigente actual no
            cambia.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Volver
          </Button>
          <SubmitButton
            type="button"
            variant="destructive"
            onClick={confirm}
            pending={isPending}
            pendingLabel="Cancelando..."
          >
            Cancelar programación
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

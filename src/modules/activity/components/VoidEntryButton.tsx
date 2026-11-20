"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { voidEntry } from "../actions";

export function VoidEntryButton({
  number,
  label,
}: {
  number: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await voidEntry(number, reason);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setReason("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            aria-label={`Anular P${number}`}
          />
        }
      >
        Anular
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular P{number}</DialogTitle>
          <DialogDescription>
            {label}. El pago sale de la lista del día y queda en Anulados. Si
            era el único pago de una membresía, esa membresía se cancela.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          maxLength={200}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <SubmitButton
            type="button"
            variant="destructive"
            onClick={confirm}
            pending={isPending}
            pendingLabel="Anulando..."
          >
            Anular pago
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

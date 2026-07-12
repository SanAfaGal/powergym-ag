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
import { renewSubscription } from "../actions";

export function RenewSubscriptionDialog({
  subscriptionId,
  clientId,
  nextStartDate,
}: {
  subscriptionId: string;
  clientId: string;
  nextStartDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      const result = await renewSubscription(subscriptionId, clientId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Renovar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar suscripción</DialogTitle>
          <DialogDescription>
            Se crea una nueva suscripción con el mismo plan, empezando el{" "}
            {new Date(`${nextStartDate}T00:00:00`).toLocaleDateString(
              "es-CO"
            )}
            .
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={isPending}>
            {isPending ? "Renovando..." : "Renovar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

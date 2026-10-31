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
import { grantConsent } from "../actions";
import { CONSENT_PARAGRAPHS, CONSENT_TEXT_VERSION } from "../lib/consent";

export function ConsentDialog({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await grantConsent(clientId, CONSENT_TEXT_VERSION);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Consentimiento guardado");
      setOpen(false);
      setAccepted(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAccepted(false);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        Registrar consentimiento
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tratamiento de datos biométricos</DialogTitle>
          <DialogDescription>
            Leele este texto a {clientName} antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          {CONSENT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>{clientName} autoriza expresamente el tratamiento de su dato biométrico facial para el control de acceso.</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <SubmitButton
            type="button"
            onClick={save}
            pending={isPending}
            pendingLabel="Guardando..."
            disabled={!accepted}
          >
            Guardar consentimiento
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

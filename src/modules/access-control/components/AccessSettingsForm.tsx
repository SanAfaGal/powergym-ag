"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { updateAccessSettings } from "../actions";
import type { AccessSettings } from "../queries";

export function AccessSettingsForm({ settings }: { settings: AccessSettings }) {
  const [threshold, setThreshold] = useState(String(settings.matchThreshold));
  const [liveness, setLiveness] = useState(settings.livenessRequired);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateAccessSettings(Number(threshold), liveness);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Configuración guardada");
    });
  }

  return (
    <div className="mb-8 flex flex-wrap items-end gap-6 rounded-lg border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="match-threshold">Umbral de similitud</Label>
        <Input
          id="match-threshold"
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Entre 0 y 1. Más alto exige un parecido mayor.
        </p>
      </div>
      <label className="flex items-center gap-2 pb-6 text-sm">
        <input
          type="checkbox"
          checked={liveness}
          onChange={(e) => setLiveness(e.target.checked)}
          className="size-4 accent-primary"
        />
        Exigir prueba de vida (parpadeo)
      </label>
      <div className="pb-5">
        <SubmitButton
          type="button"
          onClick={save}
          pending={isPending}
          pendingLabel="Guardando..."
        >
          Guardar configuración
        </SubmitButton>
      </div>
    </div>
  );
}

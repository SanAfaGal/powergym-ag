"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { updateAccessSettings } from "../actions";
import type { LivenessChallenge } from "../lib/liveness";
import type { AccessSettings } from "../queries";

const CHALLENGE_OPTIONS: {
  value: LivenessChallenge;
  label: string;
  hint?: string;
}[] = [
  { value: "blink", label: "Parpadear" },
  { value: "open_mouth", label: "Abrir la boca" },
  { value: "smile", label: "Sonreír" },
  {
    value: "turn_any",
    label: "Girar la cabeza hacia un lado",
    hint: "Menos segura: una foto inclinada frente a la cámara podría pasarla.",
  },
];

export function AccessSettingsForm({ settings }: { settings: AccessSettings }) {
  const [threshold, setThreshold] = useState(String(settings.matchThreshold));
  const [liveness, setLiveness] = useState(settings.livenessRequired);
  const [challenges, setChallenges] = useState<Set<LivenessChallenge>>(
    new Set(settings.livenessChallenges),
  );
  const [cooldown, setCooldown] = useState(String(settings.readmitCooldownMinutes));
  const [isPending, startTransition] = useTransition();

  function toggle(value: LivenessChallenge, on: boolean) {
    setChallenges((prev) => {
      const next = new Set(prev);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateAccessSettings(
        Number(threshold),
        liveness,
        [...challenges],
        Number(cooldown),
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Configuración guardada");
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="font-heading text-lg font-semibold">Reconocimiento</h2>
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
      </section>

      <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="font-heading text-lg font-semibold">Prueba de vida</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={liveness}
            onChange={(e) => setLiveness(e.target.checked)}
            className="size-4 accent-primary"
          />
          Exigir prueba de vida
        </label>
        <fieldset disabled={!liveness} className="space-y-2 disabled:opacity-50">
          <legend className="mb-1 text-sm text-muted-foreground">
            A cada persona se le pide una de estas pruebas, al azar y sin repetir
            la anterior.
          </legend>
          {CHALLENGE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={challenges.has(option.value)}
                onChange={(e) => toggle(option.value, e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                {option.label}
                {option.hint && (
                  <span className="block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="font-heading text-lg font-semibold">Reingreso</h2>
        <div className="space-y-1.5">
          <Label htmlFor="readmit-cooldown">Espera entre ingresos (minutos)</Label>
          <Input
            id="readmit-cooldown"
            type="number"
            step="1"
            min="0"
            max="60"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Si un cliente ya ingresó hace menos de este tiempo, no se le abre la
            barrera otra vez. Así nadie la mantiene abierta para que pase otra
            persona detrás. Entre 0 y 60; con 0 se desactiva.
          </p>
        </div>
      </section>

      <SubmitButton
        type="button"
        onClick={save}
        pending={isPending}
        pendingLabel="Guardando..."
      >
        Guardar configuración
      </SubmitButton>
    </div>
  );
}

"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyTextButton({
  text,
  label = "Copiar",
}: {
  text: string;
  label?: string;
}) {
  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick}>
      <CopyIcon className="size-3.5" />
      {label}
    </Button>
  );
}

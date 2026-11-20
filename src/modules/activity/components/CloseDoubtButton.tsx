"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeDoubt } from "../actions";

export function CloseDoubtButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await closeDoubt(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`D${id} cerrada`);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={onClick}
      disabled={isPending}
      title="Cerrar sin registrar nada"
      aria-label={`Cerrar D${id}`}
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <XIcon />}
    </Button>
  );
}

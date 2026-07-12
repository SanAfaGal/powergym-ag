"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cancelSchema, type CancelInput } from "../schema";
import { cancelSubscription } from "../actions";

export function CancelSubscriptionDialog({
  subscriptionId,
  clientId,
}: {
  subscriptionId: string;
  clientId: string;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CancelInput>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: "" },
  });

  async function handleSubmit(values: CancelInput) {
    setServerError(null);
    const result = await cancelSubscription(subscriptionId, clientId, values);
    if ("error" in result) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    form.reset({ reason: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        Cancelar
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancelar suscripción</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. La suscripción queda marcada
            como cancelada.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <Button
              type="submit"
              variant="destructive"
              disabled={form.formState.isSubmitting}
              className="w-full sm:w-fit"
            >
              {form.formState.isSubmitting
                ? "Cancelando..."
                : "Cancelar suscripción"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

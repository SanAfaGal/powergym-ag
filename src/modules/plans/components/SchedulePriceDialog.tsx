"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePicker } from "@/components/shared/DatePicker";
import { SubmitButton } from "@/components/shared/SubmitButton";
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
import { priceSchema, type PriceInput } from "../schema";
import { schedulePlanPrice } from "../actions";
import { bogotaToday } from "@/lib/date/bogota";

export function SchedulePriceDialog({
  planId,
  currentPrice,
}: {
  planId: string;
  currentPrice: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<PriceInput>({
    resolver: zodResolver(priceSchema),
    defaultValues: { price: currentPrice ?? 0, valid_from: bogotaToday() },
  });

  async function handleSubmit(values: PriceInput) {
    setServerError(null);
    const result = await schedulePlanPrice(planId, values);
    if ("error" in result) {
      setServerError(result.error);
      return;
    }
    toast.success("Precio programado");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Programar precio
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Programar precio</DialogTitle>
          <DialogDescription>
            {currentPrice != null
              ? `Precio actual: $${currentPrice.toLocaleString("es-CO")} COP.`
              : "Este plan no tiene un precio vigente."}{" "}
            El precio anterior se cierra automáticamente el día antes de la
            fecha efectiva.
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
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuevo precio (COP)</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valid_from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha efectiva</FormLabel>
                  <FormControl>
                    <DatePicker min={bogotaToday()} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <SubmitButton
              pending={form.formState.isSubmitting}
              pendingLabel="Guardando..."
              className="w-full sm:w-fit"
            >
              Programar
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

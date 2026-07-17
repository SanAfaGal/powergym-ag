"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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
import { subscriptionSchema, type SubscriptionInput } from "../schema";
import { createSubscription } from "../actions";
import type { PlanOption } from "../queries";
import { bogotaToday } from "@/lib/date/bogota";

function planLabel(plan: PlanOption) {
  return plan.price != null
    ? `${plan.name} — $${plan.price.toLocaleString("es-CO")}`
    : plan.name;
}

export function EnrollDialog({
  clientId,
  plans,
  disabled,
}: {
  clientId: string;
  plans: PlanOption[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SubscriptionInput>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: { plan_id: "", start_date: bogotaToday(), discount_amount: 0 },
  });
  const planId = useWatch({ control: form.control, name: "plan_id" });
  const selectedPlan = plans.find((p) => p.id === planId);

  async function handleSubmit(values: SubscriptionInput) {
    setServerError(null);
    if (
      values.discount_amount &&
      selectedPlan?.price != null &&
      values.discount_amount > selectedPlan.price
    ) {
      form.setError("discount_amount", {
        message: "El descuento no puede superar el precio del plan",
      });
      return;
    }
    const result = await createSubscription(clientId, values);
    if ("error" in result) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    form.reset({ plan_id: "", start_date: bogotaToday(), discount_amount: 0 });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={disabled} />}>
        Nueva suscripción
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva suscripción</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="plan_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) => {
                            const plan = plans.find((p) => p.id === value);
                            return plan ? planLabel(plan) : undefined;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {planLabel(plan)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de inicio</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="discount_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descuento (opcional)</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value ?? 0}
                      onChange={field.onChange}
                    />
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
              disabled={form.formState.isSubmitting}
              className="w-full sm:w-fit"
            >
              {form.formState.isSubmitting ? "Guardando..." : "Enrolar"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

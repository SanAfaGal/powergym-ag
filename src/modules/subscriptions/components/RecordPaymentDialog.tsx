"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { paymentSchema, type PaymentInput } from "../schema";
import { recordPayment } from "../actions";
import type { PaymentType } from "../queries";
import type { BankAccount } from "@/modules/bank-accounts";

export function RecordPaymentDialog({
  subscriptionId,
  clientId,
  remaining,
  paymentTypes,
  bankAccounts,
}: {
  subscriptionId: string;
  clientId: string;
  remaining: number;
  paymentTypes: PaymentType[];
  bankAccounts: BankAccount[];
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: remaining,
      payment_method: "",
      bank_account_id: "",
      notes: "",
    },
  });

  const selectedMethod = form.watch("payment_method");
  const requiresBankAccount =
    paymentTypes.find((t) => t.code === selectedMethod)
      ?.requires_bank_account ?? false;

  // react-hook-form's defaultValues are only read once, at mount -- if a
  // staff member records a partial payment and reopens this same dialog
  // instance without navigating away, the mount-time `remaining` is stale
  // (record_payment's revalidatePath refresh lands asynchronously, after
  // this component's initial render). Re-syncing on every open, against
  // whatever `remaining` prop is current at that moment, avoids prefilling
  // a stale higher amount that could be submitted as an accidental
  // overpayment.
  useEffect(() => {
    if (open) {
      form.reset({
        amount: remaining,
        payment_method: "",
        bank_account_id: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, remaining]);

  async function handleSubmit(values: PaymentInput) {
    setServerError(null);
    if (requiresBankAccount && !values.bank_account_id) {
      form.setError("bank_account_id", {
        message: "Seleccioná la cuenta que recibió el pago",
      });
      return;
    }
    const result = await recordPayment(subscriptionId, clientId, {
      ...values,
      bank_account_id: requiresBankAccount ? values.bank_account_id : undefined,
    });
    if ("error" in result) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Registrar pago
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto (COP)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de pago</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            paymentTypes.find((t) => t.code === value)?.name
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentTypes.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {requiresBankAccount && (
              <FormField
                control={form.control}
                name="bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta que recibe</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) => {
                              const acc = bankAccounts.find(
                                (a) => a.id === value
                              );
                              return acc
                                ? `${acc.account_holder_name} — ${acc.account_number}`
                                : undefined;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_holder_name} — {acc.account_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
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
              disabled={form.formState.isSubmitting}
              className="w-full sm:w-fit"
            >
              {form.formState.isSubmitting
                ? "Guardando..."
                : "Registrar pago"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

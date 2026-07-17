"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, Landmark } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { bogotaToday } from "@/lib/date/bogota";
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

// payment_types is a DB catalog, but its 2 rows map to a fixed pair of
// concepts (cash in hand vs. money that landed in a bank account) that
// each get a distinct icon in this first-choice toggle.
const PAYMENT_METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  bank: Landmark,
};

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
      payment_date: bogotaToday(),
      notes: "",
    },
  });

  const selectedMethod = useWatch({ control: form.control, name: "payment_method" });
  // requires_bank_account now only gates whether this payment method *can*
  // carry a bank account, not whether it must -- staff don't always know
  // which account received a transfer at entry time, so the field is
  // optional wherever it's shown.
  const usesBankAccount =
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
        payment_date: bogotaToday(),
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, remaining]);

  async function handleSubmit(values: PaymentInput) {
    setServerError(null);
    if (values.amount > remaining) {
      form.setError("amount", {
        message: `No puede superar el saldo pendiente ($${remaining.toLocaleString("es-CO")})`,
      });
      return;
    }
    const result = await recordPayment(subscriptionId, clientId, {
      ...values,
      bank_account_id: usesBankAccount ? values.bank_account_id : undefined,
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
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de pago</FormLabel>
                  <FormControl>
                    <Input type="date" max={bogotaToday()} {...field} />
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
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentTypes.map((t) => {
                        const Icon = PAYMENT_METHOD_ICONS[t.code] ?? Banknote;
                        const selected = field.value === t.code;
                        return (
                          <button
                            key={t.code}
                            type="button"
                            onClick={() => field.onChange(t.code)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="size-5" />
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {usesBankAccount && (
              <FormField
                control={form.control}
                name="bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta que recibe (opcional)</FormLabel>
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

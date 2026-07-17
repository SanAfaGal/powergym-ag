"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { bankAccountSchema, type BankAccountInput } from "../schema";
import type { CatalogEntry } from "../queries";

export function BankAccountForm({
  banks,
  accountTypes,
  defaultValues,
  onSubmit,
  submitLabel = "Guardar",
}: {
  banks: CatalogEntry[];
  accountTypes: CatalogEntry[];
  defaultValues?: BankAccountInput;
  onSubmit: (values: BankAccountInput) => Promise<{ error?: string } | void>;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<BankAccountInput>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: defaultValues ?? {
      bank_code: "",
      account_type_code: "",
      account_number: "",
      account_holder_name: "",
      transfer_key: "",
    },
  });

  async function handleSubmit(values: BankAccountInput) {
    setServerError(null);
    const result = await onSubmit(values);
    if (result?.error) setServerError(result.error);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="bank_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Banco</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        banks.find((b) => b.code === value)?.name
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
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
          name="account_type_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de cuenta</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        accountTypes.find((t) => t.code === value)?.name
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accountTypes.map((t) => (
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
        <FormField
          control={form.control}
          name="account_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de cuenta</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="account_holder_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titular</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="transfer_key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Clave de transferencia (opcional)</FormLabel>
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
        <SubmitButton
          pending={form.formState.isSubmitting}
          pendingLabel="Guardando..."
          className="w-full sm:w-fit"
        >
          {submitLabel}
        </SubmitButton>
      </form>
    </Form>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon } from "lucide-react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { clientSchema, type ClientInput } from "../schema";
import type { CatalogEntry } from "../queries";

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function ClientForm({
  documentTypes,
  genderTypes,
  defaultValues,
  onSubmit,
  submitLabel = "Guardar",
}: {
  documentTypes: CatalogEntry[];
  genderTypes: CatalogEntry[];
  defaultValues?: Partial<ClientInput>;
  onSubmit: (values: ClientInput) => Promise<{ error?: string } | void>;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      alias: "",
      email: "",
      dni_type: "",
      dni_number: "",
      phone: "",
      alternative_phone: "",
      birth_date: "",
      gender: "",
      address: "",
      ...defaultValues,
    },
  });

  async function handleSubmit(values: ClientInput) {
    setServerError(null);
    const result = await onSubmit(values);
    if (result?.error) setServerError(result.error);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        <p className="text-sm text-muted-foreground">
          <span className="text-destructive">*</span> Campos obligatorios —
          el resto es opcional
        </p>

        <div className="flex flex-col gap-4">
          <SectionLabel>Datos personales</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nombre(s)
                    <RequiredMark />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Si tiene más de uno, separados por espacio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Apellido(s)
                    <RequiredMark />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Si tiene más de uno, separados por espacio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alias (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dni_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de documento (opcional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar">
                          {(value: string) =>
                            documentTypes.find((d) => d.code === value)
                              ?.name ?? "Seleccionar"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {documentTypes.map((d) => (
                        <SelectItem key={d.code} value={d.code}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="dni_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de documento (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Según el tipo seleccionado"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SectionLabel>Contacto</SectionLabel>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:max-w-[calc(50%-0.5rem)]">
                <FormLabel>Correo (opcional)</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Collapsible>
          <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50">
            Datos adicionales (opcional)
            <ChevronDownIcon className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          +57
                        </span>
                        <Input placeholder="3001234567" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="alternative_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono alternativo</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          +57
                        </span>
                        <Input placeholder="3001234567" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de nacimiento</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar">
                            {(value: string) =>
                              genderTypes.find((g) => g.code === value)
                                ?.name ?? "Seleccionar"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {genderTypes.map((g) => (
                          <SelectItem key={g.code} value={g.code}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Calle, número, barrio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full sm:w-fit"
        >
          {form.formState.isSubmitting ? "Guardando..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

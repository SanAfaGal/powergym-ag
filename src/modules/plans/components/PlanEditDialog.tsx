"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { planEditSchema, type PlanEditInput } from "../schema";
import { updatePlan } from "../actions";
import type { Plan } from "../queries";

const DURATION_OPTIONS: { value: PlanEditInput["duration_unit"]; label: string }[] = [
  { value: "day", label: "Día(s)" },
  { value: "week", label: "Semana(s)" },
  { value: "month", label: "Mes(es)" },
  { value: "year", label: "Año(s)" },
];

export function PlanEditDialog({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<PlanEditInput>({
    resolver: zodResolver(planEditSchema),
    defaultValues: {
      name: plan.name,
      description: plan.description ?? "",
      duration_unit: plan.duration_unit,
      duration_count: plan.duration_count,
    },
  });

  async function handleSubmit(values: PlanEditInput) {
    setServerError(null);
    const result = await updatePlan(plan.id, values);
    if ("error" in result) {
      setServerError(result.error);
      return;
    }
    toast.success("Plan actualizado");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duración</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
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
                name="duration_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              DURATION_OPTIONS.find((o) => o.value === value)
                                ?.label
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <SubmitButton
              pending={form.formState.isSubmitting}
              pendingLabel="Guardando..."
              className="w-full sm:w-fit"
            >
              Guardar cambios
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

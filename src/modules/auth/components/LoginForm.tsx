"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { login } from "../actions";
import { loginSchema, type LoginInput } from "../schema";

export function LoginForm({ inactiveAccount }: { inactiveAccount?: boolean }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await login(values);
    if (result?.error) {
      setServerError(result.error);
    }
  }

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-lg bg-sidebar text-sidebar-foreground ring-1 ring-sidebar-border">
      <div className="border-b border-sidebar-border px-6 py-5">
        <span className="font-heading text-2xl font-bold tracking-tight">
          POWER<span className="text-primary">GYM</span>
        </span>
        <p className="mt-1 text-sm text-sidebar-foreground/60">
          Acceso de staff
        </p>
      </div>
      <div className="bg-card px-6 py-6 text-card-foreground">
        {inactiveAccount && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Tu cuenta fue desactivada. Contactá a un administrador.
          </p>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
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
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

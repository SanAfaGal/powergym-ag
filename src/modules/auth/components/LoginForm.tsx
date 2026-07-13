"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import logo from "@/app/logo.svg";
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
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static
            logo import, not worth next/image's optimization pipeline */}
        <img src={logo.src} alt="PowerGym" className="mx-auto h-32 w-auto" />
        <p className="mt-1 text-sm text-muted-foreground">
          Panel de administración
        </p>
      </div>

      <div className="rounded-lg bg-card p-6 text-card-foreground shadow-[var(--shadow-md)] sm:p-8">
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
              className="mt-2 w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </Form>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Las cuentas se crean fuera de la app. No hay registro ni recuperación
        de contraseña.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  resetStaffPasswordSchema,
  type ResetStaffPasswordInput,
} from "../schema";
import { resetStaffPassword } from "../actions";

const DEFAULT_VALUES: ResetStaffPasswordInput = { temporary_password: "" };

export function ResetStaffPasswordDialog({
  staffId,
  staffName,
  open,
  onOpenChange,
}: {
  staffId: string;
  staffName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<ResetStaffPasswordInput>({
    resolver: zodResolver(resetStaffPasswordSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function handleSubmit(values: ResetStaffPasswordInput) {
    setServerError(null);
    const result = await resetStaffPassword(staffId, values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    // Same one-time-reveal pattern as CreateStaffDialog: don't close here,
    // switch to a confirmation view so the admin can hand off the password
    // before it's gone for good.
    setResetPassword(values.temporary_password);
  }

  function resetState() {
    form.reset(DEFAULT_VALUES);
    setServerError(null);
    setResetPassword(null);
    setCopied(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && resetPassword) return;
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  }

  function handleDone() {
    onOpenChange(false);
    resetState();
  }

  async function handleCopy() {
    if (!resetPassword) return;
    try {
      await navigator.clipboard.writeText(resetPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browser, insecure context).
      // The password is still visible and selectable in the input below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={!resetPassword}>
        {resetPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Contraseña restablecida</DialogTitle>
              <DialogDescription>
                Copiá la contraseña temporal ahora. No se puede volver a
                mostrar después de cerrar esta ventana.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label>Contraseña temporal</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={resetPassword}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copiar contraseña temporal"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
              {copied && (
                <span className="text-xs text-success">
                  Copiada al portapapeles
                </span>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleDone}>
                Ya la copié, cerrar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Restablecer contraseña</DialogTitle>
              <DialogDescription>
                Definí una contraseña temporal para {staffName}.
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
                  name="temporary_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña temporal</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoComplete="off"
                          className="font-mono"
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
                  disabled={form.formState.isSubmitting}
                  className="w-full sm:w-fit"
                >
                  {form.formState.isSubmitting
                    ? "Guardando..."
                    : "Restablecer"}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
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
import { createStaffSchema, type CreateStaffInput } from "../schema";
import { createStaff } from "../actions";

const DEFAULT_VALUES: CreateStaffInput = {
  email: "",
  full_name: "",
  role: "employee",
  temporary_password: "",
};

const ROLE_LABELS: Record<CreateStaffInput["role"], string> = {
  admin: "Administrador",
  employee: "Empleado",
};

export function CreateStaffDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function handleSubmit(values: CreateStaffInput) {
    setServerError(null);
    const result = await createStaff(values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    // Don't close the dialog here -- the temporary password is only ever
    // shown this one time, so we switch to a confirmation view instead and
    // let the admin close explicitly once they've copied it (see
    // handleOpenChange below, which refuses to close from this state any
    // other way).
    setCreated({ email: values.email, password: values.temporary_password });
  }

  function resetState() {
    form.reset(DEFAULT_VALUES);
    setServerError(null);
    setCreated(null);
    setCopied(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && created) return;
    setOpen(nextOpen);
    if (!nextOpen) resetState();
  }

  function handleDone() {
    setOpen(false);
    resetState();
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browser, insecure context).
      // The password is still visible and selectable in the input below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>Nuevo staff</DialogTrigger>
      <DialogContent className="sm:max-w-sm" showCloseButton={!created}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Usuario creado</DialogTitle>
              <DialogDescription>
                Copiá la contraseña temporal ahora. No se puede volver a
                mostrar después de cerrar esta ventana.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Correo</Label>
                <Input readOnly value={created.email} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={created.password}
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
              <DialogTitle>Nuevo staff</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                noValidate
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: string) =>
                                ROLE_LABELS[value as CreateStaffInput["role"]]
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="employee">Empleado</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                    ? "Creando..."
                    : "Crear usuario"}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

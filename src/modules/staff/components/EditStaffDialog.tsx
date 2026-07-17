"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  Dialog,
  DialogContent,
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
import { updateStaffSchema, type UpdateStaffInput } from "../schema";
import { updateStaffInfo } from "../actions";

export function EditStaffDialog({
  staffId,
  fullName,
  email,
  isLoadingEmail,
  loadError,
  open,
  onOpenChange,
}: {
  staffId: string;
  fullName: string;
  email: string | null;
  isLoadingEmail: boolean;
  loadError: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateStaffInput>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: { full_name: fullName, email: "" },
  });

  // The email fetch that resolves into `email` runs from the real click
  // handler that opens this dialog (StaffActions.openEditDialog) -- not from
  // an effect here. This effect only reacts to the prop once it arrives, to
  // seed the form.
  useEffect(() => {
    if (email !== null) form.reset({ full_name: fullName, email });
  }, [email, fullName, form]);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setServerError(null);
  }

  async function handleSubmit(values: UpdateStaffInput) {
    setServerError(null);
    const result = await updateStaffInfo(staffId, values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    toast.success("Staff actualizado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar staff</DialogTitle>
        </DialogHeader>
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
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
                      <Input
                        type="email"
                        autoComplete="off"
                        disabled={isLoadingEmail}
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
              <SubmitButton
                disabled={isLoadingEmail}
                pending={form.formState.isSubmitting}
                pendingLabel="Guardando..."
                className="w-full sm:w-fit"
              >
                Guardar
              </SubmitButton>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

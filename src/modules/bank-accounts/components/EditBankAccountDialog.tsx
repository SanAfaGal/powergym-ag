"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BankAccountForm } from "./BankAccountForm";
import { updateBankAccount } from "../actions";
import type { BankAccountInput } from "../schema";
import type { BankAccount, CatalogEntry } from "../queries";

export function EditBankAccountDialog({
  account,
  banks,
  accountTypes,
}: {
  account: BankAccount;
  banks: CatalogEntry[];
  accountTypes: CatalogEntry[];
}) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(values: BankAccountInput) {
    const result = await updateBankAccount(account.id, values);
    if ("error" in result) return { error: result.error };
    toast.success("Cuenta actualizada");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cuenta bancaria</DialogTitle>
        </DialogHeader>
        <BankAccountForm
          banks={banks}
          accountTypes={accountTypes}
          defaultValues={{
            bank_code: account.bank_code,
            account_type_code: account.account_type_code,
            account_number: account.account_number,
            account_holder_name: account.account_holder_name,
            transfer_key: account.transfer_key ?? "",
          }}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
  );
}

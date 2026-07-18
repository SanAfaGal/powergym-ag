import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BankAccountTable } from "./BankAccountTable";
import { BankAccountCards } from "./BankAccountCards";
import type { BankAccount, CatalogEntry } from "../queries";

export function BankAccountList({
  accounts,
  banks,
  accountTypes,
}: {
  accounts: BankAccount[];
  banks: CatalogEntry[];
  accountTypes: CatalogEntry[];
}) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">
          Todavía no hay cuentas bancarias registradas
        </p>
        <Button
          render={<Link href="/bank-accounts/new" />}
          nativeButton={false}
          size="sm"
        >
          Agregar la primera cuenta
        </Button>
      </div>
    );
  }

  return (
    <>
      <BankAccountTable
        accounts={accounts}
        banks={banks}
        accountTypes={accountTypes}
      />
      <BankAccountCards
        accounts={accounts}
        banks={banks}
        accountTypes={accountTypes}
      />
    </>
  );
}

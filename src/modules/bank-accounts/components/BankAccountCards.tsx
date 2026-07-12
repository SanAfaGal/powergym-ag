import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EditBankAccountDialog } from "./EditBankAccountDialog";
import { DeactivateBankAccountDialog } from "./DeactivateBankAccountDialog";
import type { BankAccount, CatalogEntry } from "../queries";

export function BankAccountCards({
  accounts,
  banks,
  accountTypes,
}: {
  accounts: BankAccount[];
  banks: CatalogEntry[];
  accountTypes: CatalogEntry[];
}) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {accounts.map((account) => (
        <Card key={account.id} className="gap-2 bg-secondary/40 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {banks.find((b) => b.code === account.bank_code)?.name ??
                account.bank_code}
            </span>
            <StatusBadge isActive={account.is_active} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>
              {accountTypes.find((t) => t.code === account.account_type_code)
                ?.name ?? account.account_type_code}
            </span>
            <span className="tabular-nums">{account.account_number}</span>
            <span>{account.account_holder_name}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <EditBankAccountDialog
              account={account}
              banks={banks}
              accountTypes={accountTypes}
            />
            <DeactivateBankAccountDialog
              accountId={account.id}
              accountLabel={`${account.account_holder_name} — ${account.account_number}`}
              isActive={account.is_active}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

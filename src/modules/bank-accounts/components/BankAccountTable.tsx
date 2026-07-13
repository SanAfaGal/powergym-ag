import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EditBankAccountDialog } from "./EditBankAccountDialog";
import { DeactivateBankAccountDialog } from "./DeactivateBankAccountDialog";
import type { BankAccount, CatalogEntry } from "../queries";

export function BankAccountTable({
  accounts,
  banks,
  accountTypes,
}: {
  accounts: BankAccount[];
  banks: CatalogEntry[];
  accountTypes: CatalogEntry[];
}) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Banco</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Número</TableHead>
            <TableHead>Titular</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="sticky right-0 bg-background text-right group-hover/row:bg-[color-mix(in_oklch,var(--background),var(--primary)_5%)]">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">
                {banks.find((b) => b.code === account.bank_code)?.name ??
                  account.bank_code}
              </TableCell>
              <TableCell>
                {accountTypes.find((t) => t.code === account.account_type_code)
                  ?.name ?? account.account_type_code}
              </TableCell>
              <TableCell className="tabular-nums">
                {account.account_number}
              </TableCell>
              <TableCell>{account.account_holder_name}</TableCell>
              <TableCell>
                <StatusBadge isActive={account.is_active} />
              </TableCell>
              <TableCell className="sticky right-0 flex justify-end gap-2 bg-background text-right group-hover/row:bg-[color-mix(in_oklch,var(--background),var(--primary)_5%)]">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { isActiveAdmin } from "@/lib/auth/roles";
import {
  listBankAccounts,
  listBanks,
  listBankAccountTypes,
  BankAccountList,
} from "@/modules/bank-accounts";

export default async function BankAccountsPage() {
  if (!(await isActiveAdmin())) redirect("/dashboard");

  const [accounts, banks, accountTypes] = await Promise.all([
    listBankAccounts(),
    listBanks(),
    listBankAccountTypes(),
  ]);

  return (
    <div>
      <PageHeader
        title="Cuentas bancarias"
        description="Cuentas donde se reciben pagos por transferencia o QR."
        actions={
          <Button
            render={<Link href="/bank-accounts/new" />}
            nativeButton={false}
          >
            Nueva cuenta
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="p-4 sm:p-6">
          <BankAccountList
            accounts={accounts}
            banks={banks}
            accountTypes={accountTypes}
          />
        </div>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkPendingIndicator } from "@/components/shared/LinkPendingIndicator";
import { getAuthContext } from "@/lib/auth/session";
import {
  listBankAccounts,
  listBanks,
  listBankAccountTypes,
  BankAccountList,
} from "@/modules/bank-accounts";

export default async function BankAccountsPage() {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "admin" || !auth.profile.is_active) {
    redirect("/dashboard");
  }

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
            <LinkPendingIndicator className="ml-1.5" />
          </Button>
        }
      />
      <BankAccountList
        accounts={accounts}
        banks={banks}
        accountTypes={accountTypes}
      />
    </div>
  );
}

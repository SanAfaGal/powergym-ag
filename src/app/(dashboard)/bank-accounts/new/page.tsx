import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { isActiveAdmin } from "@/lib/auth/roles";
import {
  listBanks,
  listBankAccountTypes,
  BankAccountForm,
  createBankAccount,
} from "@/modules/bank-accounts";

export default async function NewBankAccountPage() {
  if (!(await isActiveAdmin())) redirect("/dashboard");

  const [banks, accountTypes] = await Promise.all([
    listBanks(),
    listBankAccountTypes(),
  ]);

  return (
    <div>
      <PageHeader
        title="Nueva cuenta bancaria"
        description="Agregar una cuenta para recibir pagos"
      />
      <Card className="max-w-xl p-4 sm:p-6">
        <BankAccountForm
          banks={banks}
          accountTypes={accountTypes}
          onSubmit={createBankAccount}
          submitLabel="Crear cuenta"
        />
      </Card>
    </div>
  );
}

import { RevenueByMethodBreakdown } from "./RevenueByMethodBreakdown";
import { listRevenueByBankAccount, type DashboardStats } from "../queries";
import { listPaymentTypes } from "@/modules/subscriptions";
import { listBankAccounts, listBanks } from "@/modules/bank-accounts";

export async function RevenueSection({
  statsPromise,
  start,
  end,
  isAdmin,
}: {
  statsPromise: Promise<DashboardStats>;
  start: string;
  end: string;
  isAdmin: boolean;
}) {
  const [stats, paymentTypes, revenueByAccount, bankAccounts, banks] =
    await Promise.all([
      statsPromise,
      listPaymentTypes(),
      isAdmin ? listRevenueByBankAccount(start, end) : Promise.resolve([]),
      isAdmin ? listBankAccounts() : Promise.resolve([]),
      isAdmin ? listBanks() : Promise.resolve([]),
    ]);

  return (
    <RevenueByMethodBreakdown
      stats={stats}
      paymentTypes={paymentTypes}
      accountRows={isAdmin ? revenueByAccount : undefined}
      accounts={isAdmin ? bankAccounts : undefined}
      banks={isAdmin ? banks : undefined}
    />
  );
}

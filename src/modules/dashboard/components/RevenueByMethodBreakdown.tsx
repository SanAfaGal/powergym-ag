import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BankAccount, CatalogEntry } from "@/modules/bank-accounts";
import type { PaymentType } from "@/modules/subscriptions";
import type { DashboardStats, RevenueByAccountRow } from "../queries";

export function RevenueByMethodBreakdown({
  stats,
  paymentTypes,
  accountRows,
  accounts,
  banks,
}: {
  stats: DashboardStats;
  paymentTypes: PaymentType[];
  // Bank-account destinations are admin-only (see dashboard/page.tsx) --
  // omitted entirely, not just hidden, for non-admins.
  accountRows?: RevenueByAccountRow[];
  accounts?: BankAccount[];
  banks?: CatalogEntry[];
}) {
  const entries = Object.entries(stats.financial_stats.revenue_by_method);
  const methodName = (code: string) =>
    paymentTypes.find((pt) => pt.code === code)?.name ?? code;

  // With account visibility (admin), lead with "where the money landed":
  // each bank account and the method(s) that fed it, then whatever has no
  // bank account at all (cash) as plain entries. Without it, just the flat
  // per-method totals as before.
  const showByAccount = accountRows && accountRows.length > 0;
  const cashEntries = showByAccount
    ? entries.filter(
        ([code]) =>
          !paymentTypes.find((pt) => pt.code === code)?.requires_bank_account
      )
    : entries;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por método de pago</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay ingresos registrados en este rango
          </p>
        ) : (
          // Capped height so a wide spread of accounts/methods doesn't blow
          // past the Suspense skeleton's size and shift the layout (CLS)
          <ul className="flex max-h-64 flex-col gap-4 overflow-y-auto">
            {showByAccount &&
              accountRows.map((row) => {
                const account = accounts?.find(
                  (a) => a.id === row.bank_account_id
                );
                const bankName = account
                  ? (banks?.find((b) => b.code === account.bank_code)?.name ??
                    account.bank_code)
                  : "Cuenta eliminada";
                return (
                  <li key={row.bank_account_id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {bankName}
                        {account && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {account.account_number}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums font-medium">
                        ${row.total.toLocaleString("es-CO")}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1 pl-3">
                      {row.methods.map((m) => (
                        <li
                          key={m.payment_method}
                          className="flex items-center justify-between gap-4 text-xs text-muted-foreground"
                        >
                          <span className="min-w-0 truncate">
                            {methodName(m.payment_method)}
                          </span>
                          <span className="tabular-nums">
                            ${m.amount.toLocaleString("es-CO")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}

            {cashEntries.map(([code, amount]) => (
              <li key={code} className="flex items-center justify-between">
                <span className="text-sm">{methodName(code)}</span>
                <span className="tabular-nums font-medium">
                  ${amount.toLocaleString("es-CO")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

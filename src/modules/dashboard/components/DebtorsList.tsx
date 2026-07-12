import { DebtorsTable } from "./DebtorsTable";
import { DebtorsCards } from "./DebtorsCards";
import type { DebtorRow } from "../queries";

export function DebtorsList({ debtors }: { debtors: DebtorRow[] }) {
  if (debtors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="font-medium">No hay clientes con saldo pendiente</p>
      </div>
    );
  }

  return (
    <>
      <DebtorsTable debtors={debtors} />
      <DebtorsCards debtors={debtors} />
    </>
  );
}

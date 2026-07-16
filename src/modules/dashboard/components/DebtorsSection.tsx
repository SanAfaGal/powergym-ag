import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebtorsList } from "./DebtorsList";
import { listDebtors } from "../queries";

export async function DebtorsSection() {
  const debtors = await listDebtors();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes con saldo pendiente</CardTitle>
      </CardHeader>
      <CardContent>
        <DebtorsList debtors={debtors} />
      </CardContent>
    </Card>
  );
}

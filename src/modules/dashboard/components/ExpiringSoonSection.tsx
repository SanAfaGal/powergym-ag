import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiringSoonList } from "./ExpiringSoonList";
import { listExpiringSoon } from "../queries";

export async function ExpiringSoonSection() {
  const expiringSoon = await listExpiringSoon();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripciones por vencer (próximos 7 días)</CardTitle>
      </CardHeader>
      <CardContent>
        <ExpiringSoonList rows={expiringSoon} />
      </CardContent>
    </Card>
  );
}

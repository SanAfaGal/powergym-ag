import { addDays, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import { EnrollDialog } from "./EnrollDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { RenewSubscriptionDialog } from "./RenewSubscriptionDialog";
import type { SubscriptionRow, PlanOption, PaymentType } from "../queries";
import type { BankAccount } from "@/modules/bank-accounts";

const OPEN_STATUSES = ["active", "pending_payment", "scheduled"];
const CANCELABLE_STATUSES = ["active", "pending_payment", "scheduled"];
const PAYABLE_STATUSES = ["pending_payment", "scheduled"];
const RENEWABLE_STATUSES = ["active", "expired"];

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

export function SubscriptionsSection({
  clientId,
  subscriptions,
  plans,
  paymentTypes,
  bankAccounts,
}: {
  clientId: string;
  subscriptions: SubscriptionRow[];
  plans: PlanOption[];
  paymentTypes: PaymentType[];
  bankAccounts: BankAccount[];
}) {
  const hasOpenSubscription = subscriptions.some((s) =>
    OPEN_STATUSES.includes(s.status)
  );
  const mostRecentId = subscriptions[0]?.id;

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Suscripciones</h2>
        <div className="flex flex-col items-end gap-1">
          <EnrollDialog
            clientId={clientId}
            plans={plans}
            disabled={hasOpenSubscription}
          />
          {hasOpenSubscription && (
            <span className="text-xs text-muted-foreground">
              Ya tiene una suscripción abierta
            </span>
          )}
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Todavía no tiene suscripciones
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Precio final</TableHead>
              <TableHead>Saldo pendiente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">{sub.plan_name}</TableCell>
                <TableCell className="tabular-nums">
                  {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
                </TableCell>
                <TableCell className="tabular-nums">
                  ${sub.final_price.toLocaleString("es-CO")}
                </TableCell>
                <TableCell className="tabular-nums">
                  {sub.remaining > 0
                    ? `$${sub.remaining.toLocaleString("es-CO")}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <SubscriptionStatusBadge status={sub.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {PAYABLE_STATUSES.includes(sub.status) &&
                      sub.remaining > 0 && (
                        <RecordPaymentDialog
                          subscriptionId={sub.id}
                          clientId={clientId}
                          remaining={sub.remaining}
                          paymentTypes={paymentTypes}
                          bankAccounts={bankAccounts}
                        />
                      )}
                    {sub.id === mostRecentId &&
                      RENEWABLE_STATUSES.includes(sub.status) && (
                        <RenewSubscriptionDialog
                          subscriptionId={sub.id}
                          clientId={clientId}
                          nextStartDate={format(
                            addDays(new Date(`${sub.end_date}T00:00:00`), 1),
                            "yyyy-MM-dd"
                          )}
                        />
                      )}
                    {CANCELABLE_STATUSES.includes(sub.status) && (
                      <CancelSubscriptionDialog
                        subscriptionId={sub.id}
                        clientId={clientId}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

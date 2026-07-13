import { addDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import { EnrollDialog } from "./EnrollDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { RenewSubscriptionDialog } from "./RenewSubscriptionDialog";
import type { SubscriptionRow, PlanOption, PaymentType } from "../queries";
import type { BankAccount } from "@/modules/bank-accounts";
import { bogotaToday } from "@/lib/date/bogota";

const OPEN_STATUSES = ["active", "pending_payment", "scheduled"];
const CANCELABLE_STATUSES = ["active", "pending_payment", "scheduled"];
const PAYABLE_STATUSES = ["pending_payment", "scheduled"];
const RENEWABLE_STATUSES = ["active", "expired"];

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CO");
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SubscriptionsSection({
  clientId,
  subscriptions,
  plans,
  paymentTypes,
  bankAccounts,
  allBankAccounts,
}: {
  clientId: string;
  subscriptions: SubscriptionRow[];
  plans: PlanOption[];
  paymentTypes: PaymentType[];
  bankAccounts: BankAccount[];
  allBankAccounts: BankAccount[];
}) {
  // An 'active' row whose end_date already passed doesn't count as open --
  // see the matching comment in actions.ts's createSubscription for why
  // (the daily expiration cron hasn't necessarily caught up to it yet).
  const today = bogotaToday();
  const hasOpenSubscription = subscriptions.some(
    (s) =>
      OPEN_STATUSES.includes(s.status) &&
      (s.status !== "active" || s.end_date >= today)
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
        <Card>
          <CardContent>
            <Accordion>
              {subscriptions.map((sub) => (
                <AccordionItem key={sub.id} value={sub.id}>
                  <AccordionTrigger>
                    <div className="grid flex-1 grid-cols-2 gap-2 text-left sm:grid-cols-4">
                      <div>
                        <p className="font-medium">{sub.plan_name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(sub.start_date)} –{" "}
                          {formatDate(sub.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Pagado
                        </p>
                        <p className="tabular-nums">
                          ${sub.paid.toLocaleString("es-CO")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Pendiente
                        </p>
                        <p className="tabular-nums">
                          {sub.remaining > 0
                            ? `$${sub.remaining.toLocaleString("es-CO")}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <SubscriptionStatusBadge status={sub.status} />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {sub.status === "canceled" && (
                      <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        Cancelada
                        {sub.cancellation_date &&
                          ` el ${formatDate(sub.cancellation_date)}`}
                        {sub.cancellation_reason &&
                          ` — Motivo: ${sub.cancellation_reason}`}
                      </p>
                    )}
                    <div className="mb-4 flex flex-wrap gap-2">
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

                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Pagos
                    </h3>
                    {sub.payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin pagos registrados
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {sub.payments.map((payment) => {
                          const methodName =
                            paymentTypes.find(
                              (t) => t.code === payment.payment_method
                            )?.name ?? payment.payment_method;
                          const account = payment.bank_account_id
                            ? allBankAccounts.find(
                                (a) => a.id === payment.bank_account_id
                              )
                            : null;
                          return (
                            <li
                              key={payment.id}
                              className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2 text-sm"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-medium">
                                  {methodName}
                                  {payment.bank_account_id && (
                                    <span className="font-normal text-muted-foreground">
                                      {" "}
                                      ·{" "}
                                      {account
                                        ? `${account.account_holder_name} — ${account.account_number}`
                                        : "Cuenta eliminada"}
                                    </span>
                                  )}
                                </span>
                                <span className="tabular-nums font-medium">
                                  ${payment.amount.toLocaleString("es-CO")}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                                <span>
                                  {formatDateTime(payment.payment_date)}
                                </span>
                                {payment.notes && <span>{payment.notes}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

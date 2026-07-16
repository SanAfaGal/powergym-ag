import { z } from "zod";

const planId = z.string().min(1, "Seleccioná un plan");
const startDate = z.string().min(1, "Seleccioná una fecha de inicio");

// optional but always has a numeric default (0) from the form -- see the
// z.number() vs z.coerce.number() note in the Plans schema: an
// undefined/blank input's valueAsNumber is NaN, which fails z.number()'s
// own type check before .min()/.max() run, so { message } must sit on the
// base constructor. The upper bound (can't discount more than the plan's
// price) depends on which plan is selected, which this static schema
// doesn't know -- EnrollDialog enforces that via .refine() against the
// selected plan's price.
const discountAmount = z
  .number({ message: "Ingresá un número" })
  .min(0, "El descuento no puede ser negativo")
  .multipleOf(0.01, "El descuento admite hasta 2 decimales")
  .optional();

export const subscriptionSchema = z.object({
  plan_id: planId,
  start_date: startDate,
  discount_amount: discountAmount,
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

const amount = z
  .number({ message: "Ingresá un número" })
  .positive("El monto tiene que ser mayor a 0")
  .multipleOf(0.01, "El monto admite hasta 2 decimales");

const paymentMethod = z.string().min(1, "Seleccioná un método de pago");

// bank_account_id is always optional -- staff don't always know which
// account received a bank payment at entry time. The DB trigger
// enforce_payment_bank_account (migrations 0012, 0034) only rejects it in
// the opposite direction: a payment method that doesn't use bank accounts
// (e.g. cash) can't have one attached.
export const paymentSchema = z.object({
  amount,
  payment_method: paymentMethod,
  bank_account_id: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(300, "La nota es demasiado larga")
    .optional()
    .or(z.literal("")),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Ingresá un motivo")
    .max(300, "El motivo es demasiado largo"),
});
export type CancelInput = z.infer<typeof cancelSchema>;

import { z } from "zod";

const planId = z.string().min(1, "Seleccioná un plan");
const startDate = z.string().min(1, "Seleccioná una fecha de inicio");

// optional but always has a numeric default (0) from the form -- see the
// z.number() vs z.coerce.number() note in the Plans schema: an
// undefined/blank input's valueAsNumber is NaN, which fails z.number()'s
// own type check before .min()/.max() run, so { message } must sit on the
// base constructor.
const discountPercentage = z
  .number({ message: "Ingresá un número" })
  .min(0, "El descuento no puede ser negativo")
  .max(100, "El descuento no puede superar 100%")
  .optional();

export const subscriptionSchema = z.object({
  plan_id: planId,
  start_date: startDate,
  discount_percentage: discountPercentage,
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

const amount = z
  .number({ message: "Ingresá un número" })
  .positive("El monto tiene que ser mayor a 0")
  .multipleOf(0.01, "El monto admite hasta 2 decimales");

const paymentMethod = z.string().min(1, "Seleccioná un método de pago");

// bank_account_id is intentionally NOT required at the schema level --
// whether it's required depends on the selected payment method's
// requires_bank_account flag, which is catalog data loaded at render time,
// not a fixed rule this static schema can encode. RecordPaymentDialog
// checks it manually before submitting (see Task 4), and the DB trigger
// enforce_payment_bank_account (migration 0012) is the actual source of
// truth either way.
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

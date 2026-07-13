import { z } from "zod";
import { bogotaToday } from "@/lib/date/bogota";

const DURATION_UNITS = ["day", "week", "month", "year"] as const;

const name = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(80, "El nombre es demasiado largo");

const description = z
  .string()
  .trim()
  .max(300, "La descripción es demasiado larga")
  .optional()
  .or(z.literal(""));

const durationUnit = z.enum(DURATION_UNITS, {
  message: "Seleccioná una unidad de duración",
});

// plain z.number(), not z.coerce.number(): coerce gives the schema a
// different input vs. output type (string-or-number in, number out),
// which breaks useForm<PlanInput>'s single type parameter. Inputs convert
// to number themselves via valueAsNumber (see the number Input fields).
// { message } on the base z.number() itself matters here, not just the
// chained checks: an empty/cleared number input's valueAsNumber is NaN,
// which fails z.number()'s own type check before any .int()/.positive()
// check runs -- without this it surfaces zod's default English message
// ("Invalid input: expected number, received NaN") straight to the UI.
const durationCount = z
  .number({ message: "Ingresá un número" })
  .int("Tiene que ser un número entero")
  .min(1, "Tiene que ser al menos 1")
  .max(3650, "Ese valor no parece correcto");

const price = z
  .number({ message: "Ingresá un número" })
  .positive("El precio tiene que ser mayor a 0")
  .multipleOf(0.01, "El precio admite hasta 2 decimales");

// Unlike priceSchema's valid_from (scheduling a change to an ALREADY
// effective price, so it can only move forward), a brand-new plan has no
// existing price history to protect -- staff can backdate this to when the
// plan actually started being offered (e.g. digitizing a plan that's been
// informally running for a while) or push it into the future.
const validFrom = z
  .string()
  .min(1, "Seleccioná desde cuándo rige el plan");

export const planSchema = z.object({
  name,
  description,
  duration_unit: durationUnit,
  duration_count: durationCount,
  price,
  valid_from: validFrom,
});
export type PlanInput = z.infer<typeof planSchema>;

// no is_active here -- activating/deactivating is its own action (confirm
// dialog), same split as clients, not a field silently flipped via the
// edit form.
export const planEditSchema = z.object({
  name,
  description,
  duration_unit: durationUnit,
  duration_count: durationCount,
});
export type PlanEditInput = z.infer<typeof planEditSchema>;

export const priceSchema = z.object({
  price,
  valid_from: z.string().refine((v) => {
    if (!v) return false;
    // Plain string comparison, not Date objects: both v (the date input's
    // value) and bogotaToday() are YYYY-MM-DD, so lexicographic order
    // matches chronological order -- and it sidesteps the browser's local
    // timezone entirely, rather than assuming it happens to be Bogota's.
    return v >= bogotaToday();
  }, "La fecha efectiva no puede ser en el pasado"),
});
export type PriceInput = z.infer<typeof priceSchema>;

export { DURATION_UNITS };

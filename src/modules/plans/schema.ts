import { z } from "zod";

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

export const planSchema = z.object({
  name,
  description,
  duration_unit: durationUnit,
  duration_count: durationCount,
  price,
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
    const chosen = new Date(v + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return chosen >= today;
  }, "La fecha efectiva no puede ser en el pasado"),
});
export type PriceInput = z.infer<typeof priceSchema>;

export { DURATION_UNITS };

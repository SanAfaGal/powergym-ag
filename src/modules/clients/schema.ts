import { z } from "zod";

// Letters (incl. Spanish accents/ñ), spaces, hyphens and apostrophes only --
// blocks digits/symbols in name fields, which are never a real name and
// usually mean someone fat-fingered the wrong box.
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,60}$/;
const ALIAS_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9' -]{2,30}$/;
// Colombian mobile numbers: 10 digits, always starting with 3. The "+57" is
// shown as a static prefix in the UI, not part of the stored value.
const PHONE_PATTERN = /^3\d{9}$/;

// Real length/character shape per Colombian document type -- a document
// number is only useful if it could plausibly belong to its declared type.
const DNI_PATTERNS: Record<string, RegExp> = {
  CC: /^\d{6,10}$/,
  TI: /^\d{8,11}$/,
  CE: /^[A-Za-z0-9]{5,7}$/,
  PP: /^[A-Za-z0-9]{5,12}$/,
};

function requiredName(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .regex(NAME_PATTERN, `${label} solo puede tener letras (2-60 caracteres)`);
}

function optionalPattern(pattern: RegExp, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || pattern.test(v), message);
}

export const clientSchema = z
  .object({
    first_name: requiredName("El nombre"),
    last_name: requiredName("El apellido"),
    alias: optionalPattern(
      ALIAS_PATTERN,
      "El alias puede tener letras, números y espacios (2-30 caracteres)"
    ),
    email: z
      .string()
      .trim()
      .max(120, "El correo es demasiado largo")
      .email("Correo inválido")
      .optional()
      .or(z.literal("")),
    dni_type: z.string().optional(),
    // format is validated below (superRefine), against the selected
    // dni_type's own pattern -- a bare per-field check here would either
    // duplicate that or be too loose to mean anything on its own.
    dni_number: z.string().trim().optional(),
    phone: optionalPattern(
      PHONE_PATTERN,
      "Celular colombiano inválido (10 dígitos, empieza en 3)"
    ),
    alternative_phone: optionalPattern(
      PHONE_PATTERN,
      "Celular colombiano inválido (10 dígitos, empieza en 3)"
    ),
    birth_date: z
      .string()
      .optional()
      .refine((v) => {
        if (!v) return true;
        const date = new Date(v);
        if (Number.isNaN(date.getTime())) return false;
        const today = new Date();
        const hundredYearsAgo = new Date(
          today.getFullYear() - 100,
          today.getMonth(),
          today.getDate()
        );
        return date <= today && date >= hundredYearsAgo;
      }, "Fecha de nacimiento inválida"),
    gender: z.string().optional(),
    address: z
      .string()
      .trim()
      .min(5, "La dirección es demasiado corta")
      .max(120, "La dirección es demasiado larga")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    // A document number only makes sense paired with its type -- one
    // without the other can't be verified or looked up.
    if (values.dni_number && !values.dni_type) {
      ctx.addIssue({
        code: "custom",
        path: ["dni_type"],
        message: "Seleccioná el tipo de documento",
      });
    }
    if (values.dni_type && !values.dni_number) {
      ctx.addIssue({
        code: "custom",
        path: ["dni_number"],
        message: "Ingresá el número de documento",
      });
    }
    if (values.dni_type && values.dni_number) {
      const pattern = DNI_PATTERNS[values.dni_type];
      if (pattern && !pattern.test(values.dni_number)) {
        ctx.addIssue({
          code: "custom",
          path: ["dni_number"],
          message: `Documento inválido para el tipo seleccionado`,
        });
      }
    }
  });

export type ClientInput = z.infer<typeof clientSchema>;

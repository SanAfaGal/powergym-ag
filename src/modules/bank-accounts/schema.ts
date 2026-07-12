import { z } from "zod";

const bankCode = z.string().min(1, "Seleccioná un banco");
const accountTypeCode = z.string().min(1, "Seleccioná un tipo de cuenta");

const accountNumber = z
  .string()
  .trim()
  .min(4, "El número de cuenta es demasiado corto")
  .max(40, "El número de cuenta es demasiado largo");

const accountHolderName = z
  .string()
  .trim()
  .min(2, "El nombre del titular es demasiado corto")
  .max(120, "El nombre del titular es demasiado largo");

const transferKey = z
  .string()
  .trim()
  .max(60, "La clave de transferencia es demasiado larga")
  .optional()
  .or(z.literal(""));

export const bankAccountSchema = z.object({
  bank_code: bankCode,
  account_type_code: accountTypeCode,
  account_number: accountNumber,
  account_holder_name: accountHolderName,
  transfer_key: transferKey,
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

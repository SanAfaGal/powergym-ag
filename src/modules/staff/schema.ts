import { z } from "zod";

// Mirrors supabase/config.toml (minimum_password_length = 10,
// password_requirements = lower_upper_letters_digits), so the form says what
// is wrong instead of the Auth API rejecting the password.
const temporaryPassword = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .regex(/[a-z]/, "Incluí una minúscula")
  .regex(/[A-Z]/, "Incluí una mayúscula")
  .regex(/[0-9]/, "Incluí un número");

export const createStaffSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["admin", "employee"]),
  temporary_password: temporaryPassword,
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const resetStaffPasswordSchema = z.object({
  temporary_password: temporaryPassword,
});
export type ResetStaffPasswordInput = z.infer<typeof resetStaffPasswordSchema>;

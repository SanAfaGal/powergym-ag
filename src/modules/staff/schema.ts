import { z } from "zod";

export const createStaffSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["admin", "employee"]),
  temporary_password: z.string().min(8),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

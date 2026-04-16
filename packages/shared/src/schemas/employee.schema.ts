import { z } from "zod";

export const createEmployeeSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
  full_name: z.string().min(2, "Le nom complet est requis"),
  operator_code: z
    .string()
    .min(1, "Le code operateur est requis")
    .regex(/^[a-zA-Z0-9]+$/, "Le code operateur ne doit contenir que des lettres et chiffres"),
  role: z.enum(["MANAGER", "EMPLOYEE"]),
});

export const updateEmployeeSchema = z.object({
  email: z.string().email("Email invalide").optional(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres").optional(),
  full_name: z.string().min(2, "Le nom complet est requis").optional(),
  operator_code: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9]+$/)
    .optional(),
  role: z.enum(["MANAGER", "EMPLOYEE"]).optional(),
  is_active: z.boolean().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

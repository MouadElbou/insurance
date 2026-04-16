import { z } from "zod";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Format decimal invalide")
  .optional();

export const createOperationSchema = z.object({
  type: z.enum(["PRODUCTION", "EMISSION"]),
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  policy_number: z.string().min(1, "Le numero de police est requis"),
  avenant_number: z.string().optional(),
  quittance_number: z.string().optional(),
  attestation_number: z.string().optional(),
  policy_status: z.string().optional(),
  event_type: z.string().optional(),
  emission_date: z.string().datetime().optional(),
  effective_date: z.string().datetime().optional(),
  prime_net: decimalString,
  tax_amount: decimalString,
  parafiscal_tax: decimalString,
  total_prime: decimalString,
  commission: decimalString,
});

export const operationFiltersSchema = z.object({
  employee_id: z.string().uuid().optional(),
  type: z.enum(["PRODUCTION", "EMISSION"]).optional(),
  source: z.enum(["EXCEL", "MANUAL", "SCRAPER"]).optional(),
  policy_status: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(25),
  sort_by: z
    .enum(["created_at", "effective_date", "emission_date", "prime_net", "total_prime"])
    .default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateOperationInput = z.infer<typeof createOperationSchema>;
export type OperationFiltersInput = z.infer<typeof operationFiltersSchema>;

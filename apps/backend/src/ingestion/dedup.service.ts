import type { PrismaClient } from "@prisma/client";
import type { ParsedOperation } from "./adapter.interface.js";
import { logger } from "../utils/logger.js";
import { sanitizeOptional } from "../utils/sanitize.js";

interface DedupResult {
  created_count: number;
  updated_count: number;
  skipped_count: number;
}

// In-memory cache for operator_code -> employee_id lookups during a batch
const employeeCache = new Map<string, string | null>();

async function resolveEmployeeId(
  prisma: PrismaClient,
  operatorCode: string,
): Promise<string | null> {
  const cached = employeeCache.get(operatorCode);
  if (cached !== undefined) return cached;

  const employee = await prisma.employee.findUnique({
    where: { operator_code: operatorCode },
    select: { id: true },
  });

  const id = employee?.id ?? null;
  employeeCache.set(operatorCode, id);
  return id;
}

export async function dedupAndPersist(
  prisma: PrismaClient,
  operations: ParsedOperation[],
  uploadId?: string,
): Promise<DedupResult> {
  let created_count = 0;
  let updated_count = 0;
  let skipped_count = 0;

  // Clear cache for each batch
  employeeCache.clear();

  for (const op of operations) {
    try {
      const employeeId = await resolveEmployeeId(prisma, op.operator_code);
      if (!employeeId) {
        logger.warn(
          { operator_code: op.operator_code, policy_number: op.policy_number },
          "Employee not found for operator code, skipping operation",
        );
        skipped_count++;
        continue;
      }

      // Prisma upsert using the @@unique constraint "uq_operation_dedup"
      // The composite unique key is (type, policy_number, avenant_number, quittance_number)
      // Sanitize user-controlled string fields from Excel data
      const safeClientId = sanitizeOptional(op.client_id) ?? null;
      const safeClientName = sanitizeOptional(op.client_name) ?? null;
      const safePolicyStatus = sanitizeOptional(op.policy_status) ?? null;
      const safeEventType = sanitizeOptional(op.event_type) ?? null;

      const result = await prisma.operation.upsert({
        where: {
          uq_operation_dedup: {
            type: op.type,
            policy_number: op.policy_number,
            avenant_number: op.avenant_number ?? "",
            quittance_number: op.quittance_number ?? "",
          },
        },
        create: {
          type: op.type,
          source: op.source,
          employee_id: employeeId,
          upload_id: uploadId ?? null,
          client_id: safeClientId,
          client_name: safeClientName,
          policy_number: op.policy_number,
          avenant_number: op.avenant_number ?? null,
          quittance_number: op.quittance_number ?? null,
          attestation_number: op.attestation_number ?? null,
          policy_status: safePolicyStatus,
          event_type: safeEventType,
          emission_date: op.emission_date ?? null,
          effective_date: op.effective_date ?? null,
          prime_net: op.prime_net ?? null,
          tax_amount: op.tax_amount ?? null,
          parafiscal_tax: op.parafiscal_tax ?? null,
          total_prime: op.total_prime ?? null,
          commission: op.commission ?? null,
        },
        update: {
          source: op.source,
          client_id: safeClientId ?? undefined,
          client_name: safeClientName ?? undefined,
          policy_status: safePolicyStatus ?? undefined,
          event_type: safeEventType ?? undefined,
          emission_date: op.emission_date ?? undefined,
          effective_date: op.effective_date ?? undefined,
          prime_net: op.prime_net ?? undefined,
          tax_amount: op.tax_amount ?? undefined,
          parafiscal_tax: op.parafiscal_tax ?? undefined,
          total_prime: op.total_prime ?? undefined,
          commission: op.commission ?? undefined,
          upload_id: uploadId ?? undefined,
        },
      });

      // Determine if it was a create or update by checking created_at vs updated_at
      // If they differ by less than 1 second, it was just created
      const timeDiff = Math.abs(
        result.updated_at.getTime() - result.created_at.getTime(),
      );
      if (timeDiff < 1000) {
        created_count++;
      } else {
        updated_count++;
      }
    } catch (err) {
      logger.error(
        { err, policy_number: op.policy_number, operator_code: op.operator_code },
        "Failed to upsert operation, skipping",
      );
      skipped_count++;
    }
  }

  return { created_count, updated_count, skipped_count };
}

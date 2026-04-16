import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the logger to prevent config.ts import
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { dedupAndPersist } from "../../src/ingestion/dedup.service.js";
import type { ParsedOperation } from "../../src/ingestion/adapter.interface.js";
import { Decimal } from "@prisma/client/runtime/library";

function createMockPrisma() {
  return {
    employee: {
      findUnique: vi.fn(),
    },
    operation: {
      upsert: vi.fn(),
    },
  } as any;
}

function createParsedOperation(overrides: Partial<ParsedOperation> = {}): ParsedOperation {
  return {
    type: "PRODUCTION",
    source: "EXCEL",
    operator_code: "int12345",
    policy_number: "POL-001",
    avenant_number: "AV-001",
    quittance_number: undefined,
    client_id: "123",
    client_name: "Test Client",
    prime_net: new Decimal("1000.50"),
    ...overrides,
  };
}

describe("dedupAndPersist", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("should create new operations when upsert timestamps match", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    const ops = [createParsedOperation()];
    const result = await dedupAndPersist(prisma, ops, "upload-1");

    expect(result.created_count).toBe(1);
    expect(result.updated_count).toBe(0);
    expect(result.skipped_count).toBe(0);
  });

  it("should count as updated when upsert timestamps differ", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const updatedAt = new Date("2025-01-02T00:00:00Z");
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: createdAt,
      updated_at: updatedAt,
    });

    const ops = [createParsedOperation()];
    const result = await dedupAndPersist(prisma, ops);

    expect(result.created_count).toBe(0);
    expect(result.updated_count).toBe(1);
    expect(result.skipped_count).toBe(0);
  });

  it("should skip operations when employee is not found for operator code", async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    const ops = [createParsedOperation({ operator_code: "unknown999" })];
    const result = await dedupAndPersist(prisma, ops);

    expect(result.skipped_count).toBe(1);
    expect(result.created_count).toBe(0);
    expect(result.updated_count).toBe(0);
    expect(prisma.operation.upsert).not.toHaveBeenCalled();
  });

  it("should skip operations when upsert throws an error", async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockRejectedValue(new Error("DB constraint violation"));

    const ops = [createParsedOperation()];
    const result = await dedupAndPersist(prisma, ops);

    expect(result.skipped_count).toBe(1);
    expect(result.created_count).toBe(0);
    expect(result.updated_count).toBe(0);
  });

  it("should use the composite unique key for upsert", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    const op = createParsedOperation({
      type: "EMISSION",
      policy_number: "POL-100",
      avenant_number: "AV-50",
      quittance_number: "QT-200",
    });

    await dedupAndPersist(prisma, [op]);

    const upsertCall = prisma.operation.upsert.mock.calls[0][0];
    expect(upsertCall.where.uq_operation_dedup).toEqual({
      type: "EMISSION",
      policy_number: "POL-100",
      avenant_number: "AV-50",
      quittance_number: "QT-200",
    });
  });

  it("should default avenant_number and quittance_number to empty string in where clause", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    const op = createParsedOperation({
      avenant_number: undefined,
      quittance_number: undefined,
    });

    await dedupAndPersist(prisma, [op]);

    const upsertCall = prisma.operation.upsert.mock.calls[0][0];
    expect(upsertCall.where.uq_operation_dedup.avenant_number).toBe("");
    expect(upsertCall.where.uq_operation_dedup.quittance_number).toBe("");
  });

  it("should cache employee lookups to avoid redundant DB calls", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    const ops = [
      createParsedOperation({ operator_code: "int12345", policy_number: "POL-001" }),
      createParsedOperation({ operator_code: "int12345", policy_number: "POL-002" }),
      createParsedOperation({ operator_code: "int12345", policy_number: "POL-003" }),
    ];

    await dedupAndPersist(prisma, ops);

    // Employee lookup should only be called once due to caching
    expect(prisma.employee.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.operation.upsert).toHaveBeenCalledTimes(3);
  });

  it("should handle mixed results: creates, updates, and skips", async () => {
    const now = new Date();
    const oldDate = new Date("2024-01-01");
    prisma.employee.findUnique
      .mockResolvedValueOnce({ id: "emp-1" }) // first op: found
      .mockResolvedValueOnce(null);            // second op: not found (different code)

    prisma.operation.upsert
      .mockResolvedValueOnce({ created_at: now, updated_at: now })            // created
      .mockResolvedValueOnce({ created_at: oldDate, updated_at: now });       // updated

    // Third op has the same operator_code as first (emp-1 cached), but upsert will be called
    const ops = [
      createParsedOperation({ operator_code: "int11111", policy_number: "POL-A" }),
      createParsedOperation({ operator_code: "int22222", policy_number: "POL-B" }),
      createParsedOperation({ operator_code: "int11111", policy_number: "POL-C" }),
    ];

    const result = await dedupAndPersist(prisma, ops);

    // First: created (emp found, timestamps match)
    // Second: skipped (emp not found)
    // Third: updated (emp cached from first, timestamps differ)
    expect(result.created_count).toBe(1);
    expect(result.updated_count).toBe(1);
    expect(result.skipped_count).toBe(1);
  });

  it("should pass uploadId to the create data", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    await dedupAndPersist(prisma, [createParsedOperation()], "upload-42");

    const upsertCall = prisma.operation.upsert.mock.calls[0][0];
    expect(upsertCall.create.upload_id).toBe("upload-42");
  });

  it("should handle null uploadId", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    await dedupAndPersist(prisma, [createParsedOperation()]);

    const upsertCall = prisma.operation.upsert.mock.calls[0][0];
    expect(upsertCall.create.upload_id).toBeNull();
  });

  it("should handle an empty operations array", async () => {
    const result = await dedupAndPersist(prisma, []);

    expect(result.created_count).toBe(0);
    expect(result.updated_count).toBe(0);
    expect(result.skipped_count).toBe(0);
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(prisma.operation.upsert).not.toHaveBeenCalled();
  });

  it("should clear the employee cache between batches", async () => {
    const now = new Date();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.operation.upsert.mockResolvedValue({
      created_at: now,
      updated_at: now,
    });

    // First batch
    await dedupAndPersist(prisma, [createParsedOperation({ operator_code: "int99999" })]);
    expect(prisma.employee.findUnique).toHaveBeenCalledTimes(1);

    // Second batch: same operator code should trigger a new lookup (cache was cleared)
    await dedupAndPersist(prisma, [createParsedOperation({ operator_code: "int99999" })]);
    expect(prisma.employee.findUnique).toHaveBeenCalledTimes(2);
  });
});

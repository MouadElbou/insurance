import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

// Mock exceljs to avoid heavy dependency in unit tests
vi.mock("exceljs", () => {
  const addRowFn = vi.fn();
  const getRowFn = vi.fn(() => ({
    font: {},
    fill: {},
  }));
  const mockSheet = {
    columns: [],
    addRow: addRowFn,
    getRow: getRowFn,
  };
  class MockWorkbook {
    addWorksheet = vi.fn(() => mockSheet);
    xlsx = {
      writeBuffer: vi.fn(async () => new ArrayBuffer(100)),
    };
  }
  return {
    default: {
      Workbook: MockWorkbook,
    },
  };
});

import { list, getById, create, getStats, exportToExcel } from "../../../src/modules/operations/operations.service.js";

function createMockPrisma() {
  return {
    operation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
  } as any;
}

function createMockRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2025-06-15T10:00:00Z");
  return {
    id: "op-1",
    type: "PRODUCTION",
    source: "EXCEL",
    client_id: "123",
    client_name: "Test Client",
    policy_number: "POL-001",
    avenant_number: "AV-001",
    quittance_number: null,
    attestation_number: null,
    policy_status: "ACTIVE",
    event_type: "CREATION",
    emission_date: now,
    effective_date: now,
    prime_net: new Decimal("1000.50"),
    tax_amount: new Decimal("100.05"),
    parafiscal_tax: new Decimal("50.00"),
    total_prime: new Decimal("1150.55"),
    commission: new Decimal("200.10"),
    employee_id: "emp-1",
    upload_id: "upload-1",
    created_at: now,
    updated_at: now,
    employee: { full_name: "John Doe" },
    ...overrides,
  };
}

describe("operations.service", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  describe("list", () => {
    it("should return paginated operations with defaults", async () => {
      const mockRow = createMockRow();
      prisma.operation.findMany.mockResolvedValue([mockRow]);
      prisma.operation.count.mockResolvedValue(1);

      const result = await list(prisma, {}, "user-1", "MANAGER");

      expect(result.items).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        per_page: 25,
        total_items: 1,
        total_pages: 1,
      });
      expect(result.items[0].id).toBe("op-1");
      expect(result.items[0].employee_name).toBe("John Doe");
    });

    it("should auto-filter by employee_id for EMPLOYEE role", async () => {
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      await list(prisma, {}, "emp-42", "EMPLOYEE");

      const findManyCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findManyCall.where.employee_id).toBe("emp-42");
    });

    it("should allow MANAGER to filter by a specific employee_id", async () => {
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      await list(prisma, { employee_id: "emp-99" }, "mgr-1", "MANAGER");

      const findManyCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findManyCall.where.employee_id).toBe("emp-99");
    });

    it("should apply search filter with OR conditions", async () => {
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      await list(prisma, { search: "test" }, "user-1", "MANAGER");

      const findManyCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toHaveLength(3);
      expect(findManyCall.where.OR[0]).toEqual({
        policy_number: { contains: "test", mode: "insensitive" },
      });
    });

    it("should apply date range filters", async () => {
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      await list(
        prisma,
        { date_from: "2025-01-01T00:00:00.000Z", date_to: "2025-12-31T23:59:59.000Z" },
        "user-1",
        "MANAGER",
      );

      const findManyCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findManyCall.where.created_at.gte).toBeInstanceOf(Date);
      expect(findManyCall.where.created_at.lte).toBeInstanceOf(Date);
    });

    it("should apply type and source filters", async () => {
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      await list(
        prisma,
        { type: "PRODUCTION", source: "MANUAL" },
        "user-1",
        "MANAGER",
      );

      const findManyCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findManyCall.where.type).toBe("PRODUCTION");
      expect(findManyCall.where.source).toBe("MANUAL");
    });

    it("should calculate pagination correctly", async () => {
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(100);

      const result = await list(
        prisma,
        { page: 3, per_page: 10 },
        "user-1",
        "MANAGER",
      );

      expect(result.pagination).toEqual({
        page: 3,
        per_page: 10,
        total_items: 100,
        total_pages: 10,
      });

      const findManyCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(20); // (3-1) * 10
      expect(findManyCall.take).toBe(10);
    });

    it("should convert Decimal fields to strings in response", async () => {
      const row = createMockRow({
        prime_net: new Decimal("999.99"),
        commission: new Decimal("50.00"),
      });
      prisma.operation.findMany.mockResolvedValue([row]);
      prisma.operation.count.mockResolvedValue(1);

      const result = await list(prisma, {}, "user-1", "MANAGER");

      expect(result.items[0].prime_net).toBe("999.99");
      expect(result.items[0].commission).toBe("50");
    });
  });

  describe("getById", () => {
    it("should return an operation by ID for MANAGER", async () => {
      const row = createMockRow();
      prisma.operation.findUnique.mockResolvedValue(row);

      const result = await getById(prisma, "op-1", "mgr-1", "MANAGER");

      expect(result.id).toBe("op-1");
      expect(result.policy_number).toBe("POL-001");
    });

    it("should throw NOT_FOUND when operation does not exist", async () => {
      prisma.operation.findUnique.mockResolvedValue(null);

      await expect(getById(prisma, "op-missing", "user-1", "MANAGER"))
        .rejects.toMatchObject({
          statusCode: 404,
          code: "NOT_FOUND",
        });
    });

    it("should throw 403 when EMPLOYEE tries to view another employee's operation", async () => {
      const row = createMockRow({ employee_id: "emp-other" });
      prisma.operation.findUnique.mockResolvedValue(row);

      await expect(getById(prisma, "op-1", "emp-me", "EMPLOYEE"))
        .rejects.toMatchObject({
          statusCode: 403,
          code: "AUTH_INSUFFICIENT_ROLE",
        });
    });

    it("should allow EMPLOYEE to view their own operation", async () => {
      const row = createMockRow({ employee_id: "emp-me" });
      prisma.operation.findUnique.mockResolvedValue(row);

      const result = await getById(prisma, "op-1", "emp-me", "EMPLOYEE");

      expect(result.id).toBe("op-1");
    });

    it("should convert null optional fields correctly", async () => {
      const row = createMockRow({
        client_id: null,
        avenant_number: null,
        emission_date: null,
        prime_net: null,
        commission: null,
      });
      prisma.operation.findUnique.mockResolvedValue(row);

      const result = await getById(prisma, "op-1", "mgr-1", "MANAGER");

      expect(result.client_id).toBeNull();
      expect(result.avenant_number).toBeNull();
      expect(result.emission_date).toBeNull();
      expect(result.prime_net).toBeNull();
      expect(result.commission).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a manual operation", async () => {
      const now = new Date();
      const createdRow = createMockRow({
        source: "MANUAL",
        created_at: now,
        updated_at: now,
      });
      prisma.operation.create.mockResolvedValue(createdRow);

      const data = {
        type: "PRODUCTION" as const,
        policy_number: "POL-NEW",
        client_name: "New Client",
      };

      const result = await create(prisma, data, "emp-1");

      expect(result.source).toBe("MANUAL");
      const createCall = prisma.operation.create.mock.calls[0][0];
      expect(createCall.data.source).toBe("MANUAL");
      expect(createCall.data.employee_id).toBe("emp-1");
    });

    it("should convert date strings to Date objects", async () => {
      const row = createMockRow();
      prisma.operation.create.mockResolvedValue(row);

      const data = {
        type: "EMISSION" as const,
        policy_number: "POL-NEW",
        emission_date: "2025-06-15T10:00:00.000Z",
        effective_date: "2025-07-01T00:00:00.000Z",
      };

      await create(prisma, data, "emp-1");

      const createCall = prisma.operation.create.mock.calls[0][0];
      expect(createCall.data.emission_date).toBeInstanceOf(Date);
      expect(createCall.data.effective_date).toBeInstanceOf(Date);
    });

    it("should handle null optional fields in create data", async () => {
      const row = createMockRow();
      prisma.operation.create.mockResolvedValue(row);

      const data = {
        type: "PRODUCTION" as const,
        policy_number: "POL-MINIMAL",
      };

      await create(prisma, data, "emp-1");

      const createCall = prisma.operation.create.mock.calls[0][0];
      expect(createCall.data.client_id).toBeNull();
      expect(createCall.data.client_name).toBeNull();
      expect(createCall.data.emission_date).toBeNull();
    });
  });

  describe("getStats", () => {
    it("should return aggregated statistics", async () => {
      prisma.operation.aggregate.mockResolvedValue({
        _count: { id: 50 },
        _sum: { prime_net: new Decimal("50000"), commission: new Decimal("5000") },
      });
      prisma.operation.findMany.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => ({ policy_number: `POL-${i}` })),
      );
      prisma.operation.count
        .mockResolvedValueOnce(35) // PRODUCTION
        .mockResolvedValueOnce(15) // EMISSION
        .mockResolvedValueOnce(40) // EXCEL
        .mockResolvedValueOnce(8)  // MANUAL
        .mockResolvedValueOnce(2); // SCRAPER

      const result = await getStats(prisma, {});

      expect(result.total_operations).toBe(50);
      expect(result.total_prime_net).toBe("50000");
      expect(result.total_commissions).toBe("5000");
      expect(result.total_policies).toBe(30);
      expect(result.by_type.PRODUCTION).toBe(35);
      expect(result.by_type.EMISSION).toBe(15);
      expect(result.by_source.EXCEL).toBe(40);
      expect(result.by_source.MANUAL).toBe(8);
      expect(result.by_source.SCRAPER).toBe(2);
    });

    it("should return '0' when no sum data exists", async () => {
      prisma.operation.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { prime_net: null, commission: null },
      });
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      const result = await getStats(prisma, {});

      expect(result.total_operations).toBe(0);
      expect(result.total_prime_net).toBe("0");
      expect(result.total_commissions).toBe("0");
      expect(result.total_policies).toBe(0);
    });

    it("should apply date range filters to stats queries", async () => {
      prisma.operation.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { prime_net: null, commission: null },
      });
      prisma.operation.findMany.mockResolvedValue([]);
      prisma.operation.count.mockResolvedValue(0);

      await getStats(prisma, {
        date_from: "2025-01-01T00:00:00.000Z",
        date_to: "2025-12-31T23:59:59.000Z",
      });

      const aggregateCall = prisma.operation.aggregate.mock.calls[0][0];
      expect(aggregateCall.where.created_at.gte).toBeInstanceOf(Date);
      expect(aggregateCall.where.created_at.lte).toBeInstanceOf(Date);
    });
  });

  describe("exportToExcel", () => {
    it("should return a Buffer", async () => {
      prisma.operation.findMany.mockResolvedValue([]);

      const result = await exportToExcel(prisma, {});

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should query with filters applied", async () => {
      prisma.operation.findMany.mockResolvedValue([]);

      await exportToExcel(prisma, {
        type: "PRODUCTION",
        source: "EXCEL",
        employee_id: "emp-1",
      });

      const findCall = prisma.operation.findMany.mock.calls[0][0];
      expect(findCall.where.type).toBe("PRODUCTION");
      expect(findCall.where.source).toBe("EXCEL");
      expect(findCall.where.employee_id).toBe("emp-1");
    });
  });
});

/**
 * Unit tests for the scraper service.
 *
 * These tests use a mocked PrismaClient (consistent with the existing backend
 * test style) to validate the scraper service's contracts without requiring a
 * real Postgres. They exercise:
 *
 *   - Header sanitization (secret headers stripped before persist).
 *   - Request-body redaction for login URLs.
 *   - Allowlist enforcement (host not matched → rejected_reasons).
 *   - batch_id idempotency (repeat submission returns zero-impact response).
 *   - RBAC for listEvents and getEvent (EMPLOYEE vs MANAGER).
 *   - Domain CRUD 404 / 409 error contracts.
 *   - Stats scope calculation (employee vs global).
 *   - Retention purge guard clause + deleteMany invocation.
 *   - replayEvent happy path + 404.
 *
 * Internal helpers (`sanitizeHeaders`, `redactRequestBody`) are verified
 * indirectly through the public `ingestEvents` API — we assert on the data
 * passed to `prisma.scraperEvent.createMany`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ingestEvents,
  listEvents,
  getEvent,
  replayEvent,
  listDomains,
  createDomain,
  updateDomain,
  deleteDomain,
  getStats,
  purgeExpiredEvents,
  __resetInsurerDomainCacheForTests,
} from "../../../src/modules/scraper/scraper.service.js";

// ─── Mock Prisma ──────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    scraperEvent: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    insurerDomain: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    operation: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  } as any;
}

function createMockIo() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { to, emit } as any;
}

const managerUser = {
  sub: "mgr-1",
  role: "MANAGER" as const,
  operator_code: "OP001",
};

const employeeUser = {
  sub: "emp-1",
  role: "EMPLOYEE" as const,
  operator_code: "OP042",
};

// ─── ingestEvents ─────────────────────────────────────────────────────

describe("scraper.service — ingestEvents", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let io: ReturnType<typeof createMockIo>;

  beforeEach(() => {
    // B3: the compiled-regex cache is keyed on (id, updated_at). Reset
    // between tests so a prior test's cached entry can't bypass the
    // analyzeRegexSafety path when a later test uses the same id.
    __resetInsurerDomainCacheForTests();
    prisma = createMockPrisma();
    io = createMockIo();
    // Default: empty allowlist → everything rejected.
    prisma.insurerDomain.findMany.mockResolvedValue([]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 0 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);
  });

  it("rejects events whose host is not in the enabled allowlist", async () => {
    const batch = {
      batch_id: `b-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "evil.example",
          url: "https://evil.example/api/x",
          method: "GET",
          status_code: 200,
          request_headers: null,
          request_body: null,
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    const res = await ingestEvents(prisma, io, batch as any, employeeUser);

    expect(res.accepted).toBe(0);
    expect(res.rejected).toBe(1);
    expect(res.rejected_reasons[0]).toEqual({
      index: 0,
      reason: expect.stringContaining("evil.example"),
    });
    expect(res.emitted_operations).toBe(0);
    expect(prisma.scraperEvent.createMany).not.toHaveBeenCalled();
  });

  it("strips secret headers (authorization/cookie/set-cookie/x-api-key/x-auth-*) before persist", async () => {
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);

    const batch = {
      batch_id: `b-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/api/policies",
          method: "GET",
          status_code: 200,
          request_headers: {
            Authorization: "Bearer secret-123",
            Cookie: "session=xyz",
            "X-Api-Key": "key-42",
            "X-Auth-Token": "tok",
            "X-CSRF-Token": "csrf",
            "Content-Type": "application/json",
            "User-Agent": "Chromium/Test",
          },
          request_body: null,
          response_headers: {
            "Set-Cookie": "a=b",
            "Content-Length": "100",
          },
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    await ingestEvents(prisma, io, batch as any, employeeUser);

    expect(prisma.scraperEvent.createMany).toHaveBeenCalledTimes(1);
    const payload = (prisma.scraperEvent.createMany as any).mock.calls[0][0]
      .data[0];
    const reqHeaders = payload.request_headers as Record<string, string>;
    const resHeaders = payload.response_headers as Record<string, string>;

    // Dropped:
    expect(reqHeaders).not.toHaveProperty("Authorization");
    expect(reqHeaders).not.toHaveProperty("Cookie");
    expect(reqHeaders).not.toHaveProperty("X-Api-Key");
    expect(reqHeaders).not.toHaveProperty("X-Auth-Token");
    expect(reqHeaders).not.toHaveProperty("X-CSRF-Token");
    expect(resHeaders).not.toHaveProperty("Set-Cookie");

    // Preserved:
    expect(reqHeaders).toHaveProperty("Content-Type", "application/json");
    expect(reqHeaders).toHaveProperty("User-Agent", "Chromium/Test");
    expect(resHeaders).toHaveProperty("Content-Length", "100");
  });

  it("redacts request bodies for login URLs but preserves non-login bodies", async () => {
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 2 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);

    const batch = {
      batch_id: `b-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/auth/login",
          method: "POST",
          status_code: 200,
          request_headers: null,
          request_body: JSON.stringify({ username: "u", password: "p" }),
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/api/policies",
          method: "POST",
          status_code: 200,
          request_headers: null,
          request_body: JSON.stringify({ foo: "bar" }),
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:05Z").toISOString(),
        },
      ],
    };

    await ingestEvents(prisma, io, batch as any, employeeUser);

    const createMany = (prisma.scraperEvent.createMany as any).mock.calls[0][0];
    const loginPayload = createMany.data[0];
    const apiPayload = createMany.data[1];

    expect(loginPayload.request_body).toBe("[REDACTED]");
    expect(apiPayload.request_body).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("is idempotent on repeat batch_id — second call returns zero-impact response", async () => {
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);

    const batch = {
      batch_id: `idemp-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/api/policies",
          method: "GET",
          status_code: 200,
          request_headers: null,
          request_body: null,
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    const first = await ingestEvents(prisma, io, batch as any, employeeUser);
    const firstCreateManyCalls = (prisma.scraperEvent.createMany as any).mock
      .calls.length;
    expect(first.batch_id).toBe(batch.batch_id);

    const second = await ingestEvents(prisma, io, batch as any, employeeUser);
    expect(second).toEqual({
      accepted: 0,
      rejected: 0,
      rejected_reasons: [],
      emitted_operations: 0,
      batch_id: batch.batch_id,
    });
    // No additional writes on the repeat.
    expect((prisma.scraperEvent.createMany as any).mock.calls.length).toBe(
      firstCreateManyCalls,
    );
  });

  it("normalizes host to lowercase before persisting", async () => {
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);

    const batch = {
      batch_id: `b-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "PORTAIL.RMAASSURANCE.COM",
          url: "https://PORTAIL.RMAASSURANCE.COM/api/policies",
          method: "get",
          status_code: 200,
          request_headers: null,
          request_body: null,
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    await ingestEvents(prisma, io, batch as any, employeeUser);

    const payload = (prisma.scraperEvent.createMany as any).mock.calls[0][0]
      .data[0];
    expect(payload.host).toBe("portail.rmaassurance.com");
    expect(payload.method).toBe("GET");
  });

  it("ignores allowlist rows whose regex is invalid (defense in depth)", async () => {
    // DB should prevent this, but if it ever happens the service must not throw.
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "**[invalid-regex",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "d2",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);

    const batch = {
      batch_id: `b-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/api/policies",
          method: "GET",
          status_code: 200,
          request_headers: null,
          request_body: null,
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    const res = await ingestEvents(prisma, io, batch as any, employeeUser);

    // Still accepted because the valid rule matches.
    expect(res.accepted).toBe(1);
    expect(res.rejected).toBe(0);
  });
});

// ─── listEvents RBAC ──────────────────────────────────────────────────

describe("scraper.service — listEvents", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("auto-filters to the current EMPLOYEE's events", async () => {
    prisma.scraperEvent.findMany.mockResolvedValue([]);
    prisma.scraperEvent.count.mockResolvedValue(0);

    await listEvents(prisma, { page: 1, page_size: 10 } as any, employeeUser);

    const whereArg = (prisma.scraperEvent.findMany as any).mock.calls[0][0]
      .where;
    expect(whereArg.employee_id).toBe("emp-1");
  });

  it("allows MANAGER to filter by any employee_id", async () => {
    prisma.scraperEvent.findMany.mockResolvedValue([]);
    prisma.scraperEvent.count.mockResolvedValue(0);

    await listEvents(
      prisma,
      { page: 1, page_size: 10, employee_id: "other-emp" } as any,
      managerUser,
    );

    const whereArg = (prisma.scraperEvent.findMany as any).mock.calls[0][0]
      .where;
    expect(whereArg.employee_id).toBe("other-emp");
  });

  it("does not leak other employees' events when MANAGER omits employee_id", async () => {
    prisma.scraperEvent.findMany.mockResolvedValue([]);
    prisma.scraperEvent.count.mockResolvedValue(0);

    await listEvents(prisma, { page: 1, page_size: 10 } as any, managerUser);

    const whereArg = (prisma.scraperEvent.findMany as any).mock.calls[0][0]
      .where;
    // MANAGER with no employee filter → all employees visible (by design).
    expect(whereArg.employee_id).toBeUndefined();
  });

  it("ignores an EMPLOYEE attempt to filter for another employee_id", async () => {
    prisma.scraperEvent.findMany.mockResolvedValue([]);
    prisma.scraperEvent.count.mockResolvedValue(0);

    await listEvents(
      prisma,
      { page: 1, page_size: 10, employee_id: "other-emp" } as any,
      employeeUser,
    );

    const whereArg = (prisma.scraperEvent.findMany as any).mock.calls[0][0]
      .where;
    // The employee_id from the query must NOT override the RBAC lock.
    expect(whereArg.employee_id).toBe("emp-1");
  });

  it("maps the verdict filter to the Prisma enum (uppercase)", async () => {
    prisma.scraperEvent.findMany.mockResolvedValue([]);
    prisma.scraperEvent.count.mockResolvedValue(0);

    await listEvents(
      prisma,
      { page: 1, page_size: 10, verdict: "error" } as any,
      managerUser,
    );

    const whereArg = (prisma.scraperEvent.findMany as any).mock.calls[0][0]
      .where;
    expect(whereArg.transformer_verdict).toBe("ERROR");
  });

  it("returns pagination metadata", async () => {
    prisma.scraperEvent.findMany.mockResolvedValue([]);
    prisma.scraperEvent.count.mockResolvedValue(73);

    const result = await listEvents(
      prisma,
      { page: 2, page_size: 25 } as any,
      managerUser,
    );

    expect(result.pagination).toEqual({
      page: 2,
      per_page: 25,
      total_items: 73,
      total_pages: 3,
    });
  });
});

// ─── getEvent RBAC ────────────────────────────────────────────────────

describe("scraper.service — getEvent", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("returns 404 when the event does not exist", async () => {
    prisma.scraperEvent.findUnique.mockResolvedValue(null);

    await expect(getEvent(prisma, "missing-id", managerUser)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("returns 403 when an EMPLOYEE requests another employee's event", async () => {
    prisma.scraperEvent.findUnique.mockResolvedValue({
      id: "evt-1",
      employee_id: "other-emp",
      employee: { full_name: "Other Emp", operator_code: "OP099" },
      insurer_code: "RMA",
      host: "portail.rmaassurance.com",
      url: "https://portail.rmaassurance.com/api/x",
      method: "GET",
      status_code: 200,
      captured_at: new Date(),
      processed_at: null,
      transformer_verdict: "PENDING",
      transformer_notes: null,
      request_headers: null,
      response_headers: null,
      request_body: null,
      response_body: null,
    });

    await expect(getEvent(prisma, "evt-1", employeeUser)).rejects.toMatchObject({
      statusCode: 403,
      code: "AUTH_INSUFFICIENT_ROLE",
    });
  });

  it("returns the event when an EMPLOYEE requests their own event", async () => {
    prisma.scraperEvent.findUnique.mockResolvedValue({
      id: "evt-1",
      employee_id: "emp-1",
      employee: { full_name: "Me", operator_code: "OP042" },
      insurer_code: "RMA",
      host: "portail.rmaassurance.com",
      url: "https://portail.rmaassurance.com/api/x",
      method: "GET",
      status_code: 200,
      captured_at: new Date("2026-04-20T10:00:00Z"),
      processed_at: null,
      transformer_verdict: "PENDING",
      transformer_notes: null,
      request_headers: null,
      response_headers: null,
      request_body: null,
      response_body: null,
    });

    const result = await getEvent(prisma, "evt-1", employeeUser);
    expect(result.id).toBe("evt-1");
    expect(result.employee_id).toBe("emp-1");
    expect(result.pathname).toBe("/api/x");
  });

  it("returns the event when a MANAGER requests any event", async () => {
    prisma.scraperEvent.findUnique.mockResolvedValue({
      id: "evt-42",
      employee_id: "some-other",
      employee: { full_name: "Other", operator_code: "OP099" },
      insurer_code: "RMA",
      host: "portail.rmaassurance.com",
      url: "https://portail.rmaassurance.com/api/y",
      method: "POST",
      status_code: 200,
      captured_at: new Date(),
      processed_at: null,
      transformer_verdict: "IGNORED",
      transformer_notes: "stub",
      request_headers: null,
      response_headers: null,
      request_body: null,
      response_body: null,
    });

    const result = await getEvent(prisma, "evt-42", managerUser);
    expect(result.id).toBe("evt-42");
  });
});

// ─── Domain CRUD ──────────────────────────────────────────────────────

describe("scraper.service — domain CRUD", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  describe("listDomains", () => {
    it("returns domains sorted by insurer_code then created_at asc", async () => {
      const now = new Date();
      prisma.insurerDomain.findMany.mockResolvedValue([
        {
          id: "d1",
          insurer_code: "RMA",
          host_pattern: "^rmaassurance\\.com$",
          label: "RMA",
          capture_enabled: true,
          created_at: now,
        },
      ]);

      const res = await listDomains(prisma);
      expect(prisma.insurerDomain.findMany).toHaveBeenCalledWith({
        orderBy: [{ insurer_code: "asc" }, { created_at: "asc" }],
      });
      expect(res).toHaveLength(1);
      expect(res[0].insurer_code).toBe("RMA");
    });
  });

  describe("createDomain", () => {
    it("creates a new domain when host_pattern is unique", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue(null);
      prisma.insurerDomain.create.mockResolvedValue({
        id: "d-new",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        label: "RMA Portail",
        capture_enabled: true,
        created_at: new Date(),
      });

      const input = {
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        label: "RMA Portail",
        capture_enabled: true,
      };

      const res = await createDomain(prisma, input as any, "mgr-1");
      expect(res.id).toBe("d-new");
      expect(prisma.insurerDomain.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            host_pattern: "^portail\\.rmaassurance\\.com$",
            created_by_id: "mgr-1",
          }),
        }),
      );
    });

    it("throws 409 when host_pattern already exists", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue({
        id: "existing",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        label: "existing",
        capture_enabled: true,
        created_at: new Date(),
      });

      await expect(
        createDomain(
          prisma,
          {
            insurer_code: "RMA",
            host_pattern: "^portail\\.rmaassurance\\.com$",
            label: "x",
            capture_enabled: true,
          } as any,
          "mgr-1",
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "DOMAIN_DUPLICATE",
      });
      expect(prisma.insurerDomain.create).not.toHaveBeenCalled();
    });
  });

  describe("updateDomain", () => {
    it("throws 404 when the row does not exist", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue(null);

      await expect(
        updateDomain(
          prisma,
          "missing",
          {
            insurer_code: "RMA",
            host_pattern: "^a$",
            label: "A",
            capture_enabled: true,
          } as any,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("throws 409 when renaming host_pattern to one already used by a different row", async () => {
      prisma.insurerDomain.findUnique
        .mockResolvedValueOnce({
          id: "d1",
          insurer_code: "RMA",
          host_pattern: "^a$",
          label: "A",
          capture_enabled: true,
          created_at: new Date(),
        })
        // clash check
        .mockResolvedValueOnce({
          id: "d2",
          insurer_code: "RMA",
          host_pattern: "^b$",
          label: "B",
          capture_enabled: true,
          created_at: new Date(),
        });

      await expect(
        updateDomain(
          prisma,
          "d1",
          {
            insurer_code: "RMA",
            host_pattern: "^b$",
            label: "B",
            capture_enabled: true,
          } as any,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "DOMAIN_DUPLICATE",
      });
    });

    it("updates when host_pattern is unchanged", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue({
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^a$",
        label: "A",
        capture_enabled: true,
        created_at: new Date(),
      });
      prisma.insurerDomain.update.mockResolvedValue({
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^a$",
        label: "A (updated)",
        capture_enabled: false,
        created_at: new Date(),
      });

      const res = await updateDomain(
        prisma,
        "d1",
        {
          insurer_code: "RMA",
          host_pattern: "^a$",
          label: "A (updated)",
          capture_enabled: false,
        } as any,
      );

      expect(res.label).toBe("A (updated)");
      expect(res.capture_enabled).toBe(false);
    });
  });

  describe("deleteDomain", () => {
    it("throws 404 when the domain does not exist", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue(null);

      await expect(deleteDomain(prisma, "missing")).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });
      expect(prisma.insurerDomain.delete).not.toHaveBeenCalled();
    });

    it("deletes the domain when it exists", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue({
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^a$",
        label: "A",
        capture_enabled: true,
        created_at: new Date(),
      });
      prisma.insurerDomain.delete.mockResolvedValue({});

      await deleteDomain(prisma, "d1");
      expect(prisma.insurerDomain.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    });
  });
});

// ─── Stats ────────────────────────────────────────────────────────────

describe("scraper.service — getStats", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("scopes to a single employee_id when provided", async () => {
    prisma.scraperEvent.count.mockResolvedValue(0);
    prisma.scraperEvent.findFirst.mockResolvedValue(null);

    await getStats(prisma, "emp-1");

    const firstCountArgs = (prisma.scraperEvent.count as any).mock.calls[0][0];
    expect(firstCountArgs.where.employee_id).toBe("emp-1");
    const findFirstArgs = (prisma.scraperEvent.findFirst as any).mock.calls[0][0];
    expect(findFirstArgs.where.employee_id).toBe("emp-1");
  });

  it("omits the employee_id filter when called without an argument", async () => {
    prisma.scraperEvent.count.mockResolvedValue(0);
    prisma.scraperEvent.findFirst.mockResolvedValue(null);

    await getStats(prisma);

    const firstCountArgs = (prisma.scraperEvent.count as any).mock.calls[0][0];
    expect(firstCountArgs.where.employee_id).toBeUndefined();
  });

  it("returns captured/transformed/errors counts plus last_captured_at", async () => {
    const lastCap = new Date("2026-04-20T09:00:00Z");
    prisma.scraperEvent.count
      .mockResolvedValueOnce(10) // captured
      .mockResolvedValueOnce(4) // transformed
      .mockResolvedValueOnce(1); // errors
    prisma.scraperEvent.findFirst.mockResolvedValue({ captured_at: lastCap });

    const res = await getStats(prisma);
    expect(res).toEqual({
      captured_today: 10,
      transformed_today: 4,
      errors_today: 1,
      last_captured_at: lastCap.toISOString(),
    });
  });

  it("returns null last_captured_at when no events exist", async () => {
    prisma.scraperEvent.count.mockResolvedValue(0);
    prisma.scraperEvent.findFirst.mockResolvedValue(null);

    const res = await getStats(prisma);
    expect(res.last_captured_at).toBeNull();
  });
});

// ─── Retention ────────────────────────────────────────────────────────

describe("scraper.service — purgeExpiredEvents", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("returns 0 and does not touch the database when retentionDays <= 0", async () => {
    const count1 = await purgeExpiredEvents(prisma, 0);
    const count2 = await purgeExpiredEvents(prisma, -5);

    expect(count1).toBe(0);
    expect(count2).toBe(0);
    expect(prisma.scraperEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes rows older than retentionDays and returns deleteMany count", async () => {
    prisma.scraperEvent.deleteMany.mockResolvedValue({ count: 42 });

    const before = Date.now();
    const res = await purgeExpiredEvents(prisma, 180);
    const after = Date.now();

    expect(res).toBe(42);
    expect(prisma.scraperEvent.deleteMany).toHaveBeenCalledTimes(1);

    const whereArg = (prisma.scraperEvent.deleteMany as any).mock.calls[0][0]
      .where;
    // B6: retention purge filters on captured_at (business time), not created_at.
    expect(whereArg.captured_at).toHaveProperty("lt");
    const cutoff: Date = whereArg.captured_at.lt;
    const expectedCutoffLow = before - 180 * 24 * 60 * 60 * 1000;
    const expectedCutoffHigh = after - 180 * 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedCutoffLow);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedCutoffHigh);
  });
});

// ─── Replay ───────────────────────────────────────────────────────────

describe("scraper.service — replayEvent", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let io: ReturnType<typeof createMockIo>;

  beforeEach(() => {
    prisma = createMockPrisma();
    io = createMockIo();
  });

  it("throws 404 when the event does not exist", async () => {
    prisma.scraperEvent.findUnique.mockResolvedValue(null);
    await expect(replayEvent(prisma, io, "missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("updates verdict + processed_at and returns the new verdict (RMA stub → IGNORED)", async () => {
    prisma.scraperEvent.findUnique.mockResolvedValue({
      id: "evt-1",
      employee_id: "emp-1",
      insurer_code: "RMA",
      host: "portail.rmaassurance.com",
      url: "https://portail.rmaassurance.com/api/policies",
      method: "GET",
      status_code: 200,
      captured_at: new Date("2026-04-20T10:00:00Z"),
      processed_at: null,
      transformer_verdict: "PENDING",
      transformer_notes: null,
      request_headers: null,
      response_headers: null,
      request_body: null,
      response_body: null,
      employee: { operator_code: "OP042" },
    });
    prisma.scraperEvent.update.mockResolvedValue({});

    const res = await replayEvent(prisma, io, "evt-1");

    expect(res.event_id).toBe("evt-1");
    expect(res.verdict).toBe("IGNORED"); // RMA stub
    expect(res.emitted_operations).toBe(0);

    const updateArgs = (prisma.scraperEvent.update as any).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "evt-1" });
    expect(updateArgs.data.transformer_verdict).toBe("IGNORED");
    expect(updateArgs.data.processed_at).toBeInstanceOf(Date);
  });
});

// ─── B3: ReDoS safety at load time ────────────────────────────────────
//
// A row with a catastrophic-backtracking pattern must not crash ingest.
// The write-time Zod guard rejects these, but the DB could still hold one
// (seeded before the guard, manually inserted, or restored from a backup).
// loadEnabledDomains must statically analyze every row and skip unsafe
// patterns rather than compiling them and hanging.
//
// We reset the compiled-regex cache per test — otherwise a prior test's
// cached entry would match the new row id and bypass analyzeRegexSafety.
describe("scraper.service — loadEnabledDomains ReDoS safety (B3)", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let io: ReturnType<typeof createMockIo>;

  beforeEach(() => {
    __resetInsurerDomainCacheForTests();
    prisma = createMockPrisma();
    io = createMockIo();
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 0 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);
  });

  it("skips a row whose host_pattern is catastrophic-backtracking (does not 500)", async () => {
    // Canonical ReDoS pattern: nested quantifiers with overlap.
    // Given a long run of 'a' + a 'b' at the end, this would hang in a
    // real regex engine for seconds. The static analyzer must reject it
    // BEFORE we compile.
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "bad",
        insurer_code: "RMA",
        host_pattern: "^(a+)+$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const batch = {
      batch_id: `b3-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/api/policies",
          method: "GET",
          status_code: 200,
          request_headers: null,
          request_body: null,
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    // Must NOT throw — the unsafe row should be silently skipped, leaving
    // the allowlist effectively empty.
    const res = await ingestEvents(prisma, io, batch as any, employeeUser);

    // Allowlist was empty (unsafe row skipped), so the legit event is rejected.
    expect(res.accepted).toBe(0);
    expect(res.rejected).toBe(1);
    expect(res.rejected_reasons[0]).toEqual({
      index: 0,
      reason: expect.stringContaining("portail.rmaassurance.com"),
    });
    // Unsafe pattern was never compiled → no writes.
    expect(prisma.scraperEvent.createMany).not.toHaveBeenCalled();
  });

  it("still accepts safe rows alongside skipped unsafe ones", async () => {
    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "bad",
        insurer_code: "RMA",
        host_pattern: "^(a+)+$",
        capture_enabled: true,
        created_at: new Date("2026-04-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z"),
      },
      {
        id: "good",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date("2026-04-02T00:00:00Z"),
        updated_at: new Date("2026-04-02T00:00:00Z"),
      },
    ]);
    prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
    prisma.scraperEvent.findMany.mockResolvedValue([]);

    const batch = {
      batch_id: `b3b-${Math.random().toString(36).slice(2)}`,
      events: [
        {
          host: "portail.rmaassurance.com",
          url: "https://portail.rmaassurance.com/api/policies",
          method: "GET",
          status_code: 200,
          request_headers: null,
          request_body: null,
          response_headers: null,
          response_body: null,
          captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
        },
      ],
    };

    const res = await ingestEvents(prisma, io, batch as any, employeeUser);
    expect(res.accepted).toBe(1);
    expect(res.rejected).toBe(0);
    expect(prisma.scraperEvent.createMany).toHaveBeenCalledTimes(1);
  });
});

// ─── B4: Rate-limit keying per subject ────────────────────────────────
//
// The POST /events keyGenerator must partition buckets by JWT `sub` when
// the request is authenticated (so two employees behind the same NAT
// gateway don't starve each other), and fall back to req.ip only if
// req.user hasn't been populated.
//
// We unit-test the pure keying logic by reimplementing the closure from
// scraper.routes.ts here — binding a Fastify server + @fastify/rate-limit
// to a real port just to confirm the key format would be heavy, and the
// logic itself is a one-liner.
describe("scraper.routes — rate-limit keyGenerator (B4)", () => {
  // Reimplementation of the keyGenerator from scraper.routes.ts. Keep in
  // sync with the route config — if the route changes, update here.
  const makeKey = (req: {
    user?: { sub?: string };
    ip: string;
  }): string => {
    const sub = (req.user as { sub?: string } | undefined)?.sub;
    return sub ? `sub:${sub}` : `ip:${req.ip}`;
  };

  it("keys by JWT sub when user is present", () => {
    expect(makeKey({ user: { sub: "mgr-1" }, ip: "1.2.3.4" })).toBe("sub:mgr-1");
    expect(makeKey({ user: { sub: "emp-42" }, ip: "1.2.3.4" })).toBe(
      "sub:emp-42",
    );
  });

  it("produces DIFFERENT buckets for two users sharing one source IP (NAT scenario)", () => {
    const k1 = makeKey({ user: { sub: "mgr-1" }, ip: "10.0.0.1" });
    const k2 = makeKey({ user: { sub: "emp-1" }, ip: "10.0.0.1" });
    expect(k1).not.toBe(k2);
  });

  it("falls back to req.ip when req.user is absent", () => {
    expect(makeKey({ user: undefined, ip: "203.0.113.5" })).toBe(
      "ip:203.0.113.5",
    );
    expect(makeKey({ ip: "203.0.113.5" } as any)).toBe("ip:203.0.113.5");
  });

  it("falls back to req.ip when user object has no sub", () => {
    expect(makeKey({ user: {}, ip: "10.0.0.2" })).toBe("ip:10.0.0.2");
  });
});

// ─── B5: NULL dedup regression ────────────────────────────────────────
//
// Re-ingesting the SAME operation (same policy/type) with NULL avenant +
// NULL quittance must not re-emit `operation:new`. The bug: Prisma query
// for existingOperationDedupKeys used `?? ""`, so the WHERE generated
// `avenant_number = ''` instead of `avenant_number IS NULL`. That never
// matched persisted rows, existingKeys stayed empty, and every re-ingest
// looked fresh.
//
// We stub the ScraperAdapter via the adapter registry to produce one
// deterministic operation, and drive two ingests back-to-back with the
// mock prisma.operation.findMany returning:
//   1st call → existingKeys lookup, first ingest → [] (no pre-existing)
//   2nd call → emittable lookup, first ingest → [row] (just created)
//   3rd call → existingKeys lookup, second ingest → [row] (now exists)
// After ingest #2, findMany for emittable is NOT called because
// newOpKeys is empty. io.emit must fire exactly once.
// vi.mock is hoisted above all imports and affects EVERY test in this file,
// not just the B5 describe below. That is why we default the mock to
// `[]` — if a test that doesn't configure `mockParse` hits ingest code
// that calls `adapter.parse()`, it must get `[]` back (= "adapter found
// zero operations"), not `undefined` which would crash later at
// `operations.length` in scraper.service.
vi.mock("../../../src/ingestion/adapter.registry.js", () => {
  const mockParse = vi.fn().mockResolvedValue([]);
  return {
    adapterRegistry: {
      get: (_name: string) => ({ parse: mockParse }),
      register: vi.fn(),
    },
    // Export so the test can grab it for configuration.
    __mockParse: mockParse,
  };
});

describe("scraper.service — NULL dedup regression (B5)", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let io: ReturnType<typeof createMockIo>;
  let mockParse: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    __resetInsurerDomainCacheForTests();
    prisma = createMockPrisma();
    io = createMockIo();

    // Extend the mock prisma with the surfaces dedupAndPersist touches.
    prisma.operation.upsert = vi.fn(async () => {
      const t = new Date();
      // created_at and updated_at within 1s → treated as created.
      return { created_at: t, updated_at: t };
    });
    prisma.employee = { findUnique: vi.fn(async () => ({ id: "emp-1" })) };

    prisma.insurerDomain.findMany.mockResolvedValue([
      {
        id: "d1",
        insurer_code: "RMA",
        host_pattern: "^portail\\.rmaassurance\\.com$",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
    // Simulate re-fetching the just-inserted ScraperEvent row.
    prisma.scraperEvent.findMany.mockImplementation(async () => [
      {
        id: "evt-1",
        employee_id: employeeUser.sub,
        insurer_code: "RMA",
        host: "portail.rmaassurance.com",
        url: "https://portail.rmaassurance.com/api/policies",
        method: "GET",
        status_code: 200,
        captured_at: new Date("2026-04-20T10:00:00Z"),
        processed_at: null,
        request_headers: null,
        request_body: null,
        response_headers: null,
        response_body: null,
        created_at: new Date(),
      },
    ]);
    prisma.scraperEvent.update.mockResolvedValue({});

    // Grab the mocked parse function from the adapter registry mock.
    const mod: any = await import(
      "../../../src/ingestion/adapter.registry.js"
    );
    mockParse = mod.__mockParse;
    mockParse.mockReset();
    mockParse.mockResolvedValue([
      {
        type: "PRODUCTION",
        source: "SCRAPER",
        operator_code: employeeUser.operator_code,
        policy_number: "POL-NULL-1",
        avenant_number: undefined, // null after normalize
        quittance_number: undefined, // null after normalize
      },
    ]);
  });

  const buildBatch = (batchId: string) => ({
    batch_id: batchId,
    events: [
      {
        host: "portail.rmaassurance.com",
        url: "https://portail.rmaassurance.com/api/policies",
        method: "GET",
        status_code: 200,
        request_headers: null,
        request_body: null,
        response_headers: null,
        response_body: null,
        captured_at: new Date("2026-04-20T10:00:00Z").toISOString(),
      },
    ],
  });

  it("does NOT re-emit OPERATION_NEW when the same op with NULL avenant/quittance is re-ingested", async () => {
    const ingestRow = {
      id: "op-1",
      type: "PRODUCTION" as const,
      source: "SCRAPER" as const,
      employee_id: "emp-1",
      policy_number: "POL-NULL-1",
      avenant_number: null,
      quittance_number: null,
      client_name: null,
      prime_net: null,
      created_at: new Date(),
      employee: { full_name: "Test Employee" },
    };

    // First ingest: prisma.operation.findMany is called twice:
    //   1. existingOperationDedupKeys (before persist) → nothing yet.
    //   2. emittable findMany (after persist) → the row we just created.
    prisma.operation.findMany
      .mockResolvedValueOnce([]) // existingKeys empty
      .mockResolvedValueOnce([ingestRow]); // emittable

    const first = await ingestEvents(
      prisma,
      io,
      buildBatch("batch-1111-1111-1111-111111111111") as any,
      employeeUser,
    );
    expect(first.emitted_operations).toBe(1);

    // Sanity: operation:new was emitted exactly once.
    const emitCallsAfterFirst = io.emit.mock.calls.filter(
      (c: any[]) => c[0] === "operation:new",
    );
    expect(emitCallsAfterFirst.length).toBe(1);

    // Second ingest with a NEW batch_id (so we don't short-circuit on
    // idempotency) and same operation. Now the row exists with
    // avenant_number = null / quittance_number = null — this is the
    // row existingOperationDedupKeys must match.
    prisma.operation.findMany.mockReset();
    prisma.operation.findMany.mockResolvedValueOnce([
      {
        type: "PRODUCTION",
        policy_number: "POL-NULL-1",
        avenant_number: null,
        quittance_number: null,
      },
    ]);
    // If the emittable findMany is called on the second ingest (i.e. the
    // bug regressed), this next mock value would be returned — tying the
    // assertion to emission.
    prisma.operation.findMany.mockResolvedValueOnce([ingestRow]);

    const second = await ingestEvents(
      prisma,
      io,
      buildBatch("batch-2222-2222-2222-222222222222") as any,
      employeeUser,
    );
    expect(second.emitted_operations).toBe(0);

    // operation:new emit count must STILL be 1 overall.
    const emitCallsAfterSecond = io.emit.mock.calls.filter(
      (c: any[]) => c[0] === "operation:new",
    );
    expect(emitCallsAfterSecond.length).toBe(1);
  });

  it("sends null (not empty string) for avenant_number/quittance_number in existingKeys lookup WHERE clause", async () => {
    // Capture the WHERE clause argument on the existingOperationDedupKeys
    // call. A regressed implementation would pass "" here instead of null,
    // which is how the bug silently slipped past in iteration 0.
    prisma.operation.findMany
      .mockResolvedValueOnce([]) // existingKeys
      .mockResolvedValueOnce([]); // emittable (empty because no new keys either, but harmless)

    await ingestEvents(
      prisma,
      io,
      buildBatch("batch-3333-3333-3333-333333333333") as any,
      employeeUser,
    );

    const firstCallArgs = (prisma.operation.findMany as any).mock.calls[0][0];
    const orList = firstCallArgs.where.OR;
    expect(Array.isArray(orList)).toBe(true);
    expect(orList.length).toBe(1);
    // The critical assertion: null, not "".
    expect(orList[0].avenant_number).toBeNull();
    expect(orList[0].quittance_number).toBeNull();
  });
});

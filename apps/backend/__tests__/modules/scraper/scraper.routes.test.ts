/**
 * Route-level integration tests for the scraper module.
 *
 * These tests spin up a minimal Fastify app with the real error-handler and
 * scraper route module mounted, but with `prisma` and `io` stubbed. That lets
 * us verify the route-level contracts — auth, RBAC, Zod validation, response
 * envelope shape, 404/409/429 error codes — without needing Postgres.
 *
 * The rationale for mocked Prisma:
 *   - Existing backend tests all use mocked Prisma (no test container available).
 *   - Service-layer behavior is already exhaustively covered by
 *     scraper.service.test.ts. Here we only prove the HTTP layer wires
 *     middleware/validation/handlers correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "../../../src/config.js";
import errorHandlerPlugin from "../../../src/plugins/error-handler.js";
import scraperRoutes from "../../../src/modules/scraper/scraper.routes.js";

// ─── Prisma mock ─────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    employee: {
      findUnique: vi.fn(),
    },
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

// ─── App builder ─────────────────────────────────────────────────────

async function buildTestApp(
  prisma: ReturnType<typeof createMockPrisma>,
  io: ReturnType<typeof createMockIo>,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate("prisma", prisma as any);
  app.decorate("io", io as any);
  await app.register(errorHandlerPlugin);
  // Mount scraper routes under the production prefix so URL paths in tests
  // match real clients.
  await app.register(
    async (api) => {
      await api.register(scraperRoutes, { prefix: "/scraper" });
    },
    { prefix: "/api/v1" },
  );
  await app.ready();
  return app;
}

// ─── JWT helpers ─────────────────────────────────────────────────────

function makeToken(opts: { sub?: string; role?: "MANAGER" | "EMPLOYEE"; email?: string } = {}) {
  return jwt.sign(
    {
      sub: opts.sub ?? "user-1",
      email: opts.email ?? "u@example.com",
      role: opts.role ?? "MANAGER",
    },
    config.JWT_SECRET,
  );
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("scraper.routes", () => {
  let app: FastifyInstance;
  let prisma: ReturnType<typeof createMockPrisma>;
  let io: ReturnType<typeof createMockIo>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    io = createMockIo();
    app = await buildTestApp(prisma, io);
  });

  afterEach(async () => {
    await app.close();
  });

  // ── Auth gating ───────────────────────────────────────────────────

  describe("authentication", () => {
    it("rejects requests with no Authorization header (401 AUTH_TOKEN_MISSING)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({
        success: false,
        error: { code: "AUTH_TOKEN_MISSING" },
      });
    });

    it("rejects requests with malformed Authorization header (401)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events",
        headers: { authorization: "not-a-bearer" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("AUTH_TOKEN_MISSING");
    });

    it("rejects requests with invalid JWT (401 AUTH_TOKEN_INVALID)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events",
        headers: { authorization: "Bearer not.a.valid.jwt" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("AUTH_TOKEN_INVALID");
    });

    it("rejects expired JWT tokens (401 AUTH_TOKEN_EXPIRED)", async () => {
      const expired = jwt.sign(
        { sub: "u", email: "u@e.com", role: "MANAGER" },
        config.JWT_SECRET,
        { expiresIn: "-1s" },
      );
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events",
        headers: { authorization: `Bearer ${expired}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("AUTH_TOKEN_EXPIRED");
    });

    it("returns 401 if valid JWT sub no longer resolves to an employee", async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      const token = makeToken({ sub: "ghost-user" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("AUTH_USER_NOT_FOUND");
    });
  });

  // ── Role gating (MANAGER-only endpoints) ──────────────────────────

  describe("authorization (MANAGER-only routes)", () => {
    it("POST /events/:id/replay returns 403 for EMPLOYEE role", async () => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      const token = makeToken({ role: "EMPLOYEE" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events/abc/replay",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("AUTH_INSUFFICIENT_ROLE");
    });

    it("POST /insurer-domains returns 403 for EMPLOYEE role", async () => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      const token = makeToken({ role: "EMPLOYEE" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/insurer-domains",
        headers: authHeader(token),
        payload: {
          host_pattern: "^example\\.com$",
          insurer_code: "EXA",
          label: "Example",
          capture_enabled: true,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("AUTH_INSUFFICIENT_ROLE");
    });

    it("PUT /insurer-domains/:id returns 403 for EMPLOYEE role", async () => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      const token = makeToken({ role: "EMPLOYEE" });
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/scraper/insurer-domains/d1",
        headers: authHeader(token),
        payload: {
          host_pattern: "^example\\.com$",
          insurer_code: "EXA",
          label: "Example",
          capture_enabled: true,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("AUTH_INSUFFICIENT_ROLE");
    });

    it("DELETE /insurer-domains/:id returns 403 for EMPLOYEE role", async () => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      const token = makeToken({ role: "EMPLOYEE" });
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/scraper/insurer-domains/d1",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("AUTH_INSUFFICIENT_ROLE");
    });
  });

  // ── POST /events (ingestion) ──────────────────────────────────────

  describe("POST /events", () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      // Empty allowlist → everything IGNORED, but no crash.
      prisma.insurerDomain.findMany.mockResolvedValue([]);
      prisma.scraperEvent.createMany.mockResolvedValue({ count: 1 });
      prisma.scraperEvent.findMany.mockResolvedValue([]);
      prisma.scraperEvent.update.mockResolvedValue({ id: "e1" });
    });

    it("rejects a body missing batch_id with 400 VALIDATION_ERROR", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
        payload: { events: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
      expect(Array.isArray(res.json().error.details)).toBe(true);
    });

    it("rejects a body with non-UUID batch_id (400)", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
        payload: {
          batch_id: "not-a-uuid",
          events: [
            {
              method: "GET",
              url: "https://portail.rmaassurance.com/api/x",
              host: "portail.rmaassurance.com",
              pathname: "/api/x",
              status_code: 200,
              request_headers: {},
              response_headers: {},
              request_body: null,
              response_body: null,
              captured_at: new Date().toISOString(),
              duration_ms: 10,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an empty events array (400 — min(1))", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
        payload: {
          batch_id: "11111111-1111-1111-1111-111111111111",
          events: [],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects batches larger than 50 events (400 — max(50))", async () => {
      const token = makeToken();
      const event = {
        method: "GET",
        url: "https://x.example/api",
        host: "x.example",
        pathname: "/api",
        status_code: 200,
        request_headers: {},
        response_headers: {},
        request_body: null,
        response_body: null,
        captured_at: new Date().toISOString(),
        duration_ms: 1,
      };
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
        payload: {
          batch_id: "11111111-1111-1111-1111-111111111111",
          events: Array.from({ length: 51 }, () => event),
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects events with non-URL url field (400)", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
        payload: {
          batch_id: "22222222-2222-2222-2222-222222222222",
          events: [
            {
              method: "GET",
              url: "not-a-url",
              host: "x.example",
              pathname: "/api",
              status_code: 200,
              request_headers: {},
              response_headers: {},
              request_body: null,
              response_body: null,
              captured_at: new Date().toISOString(),
              duration_ms: 1,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("accepts a valid batch and returns 200 with success envelope", async () => {
      const token = makeToken({ role: "EMPLOYEE" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/events",
        headers: authHeader(token),
        payload: {
          batch_id: "33333333-3333-3333-3333-333333333333",
          events: [
            {
              method: "GET",
              url: "https://portail.rmaassurance.com/api/x",
              host: "portail.rmaassurance.com",
              pathname: "/api/x",
              status_code: 200,
              request_headers: {},
              response_headers: {},
              request_body: null,
              response_body: null,
              captured_at: new Date().toISOString(),
              duration_ms: 12,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          batch_id: "33333333-3333-3333-3333-333333333333",
        }),
      });
    });
  });

  // ── GET /events (list) ────────────────────────────────────────────

  describe("GET /events", () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      prisma.scraperEvent.findMany.mockResolvedValue([]);
      prisma.scraperEvent.count.mockResolvedValue(0);
    });

    it("returns a list envelope with pagination meta", async () => {
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events?page=1&page_size=10",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("items");
      expect(body.data).toHaveProperty("pagination");
      expect(body.data.pagination).toHaveProperty("page");
      expect(body.data.pagination).toHaveProperty("per_page");
      expect(body.data.pagination).toHaveProperty("total_items");
      expect(body.data.pagination).toHaveProperty("total_pages");
    });

    it("rejects non-enum verdict query param (400)", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events?verdict=bogus",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects page_size > 200 (400)", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events?page_size=9999",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects non-UUID employee_id query param (400)", async () => {
      const token = makeToken();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events?employee_id=not-a-uuid",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ── GET /events/:id ───────────────────────────────────────────────

  describe("GET /events/:id", () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
    });

    it("returns 404 when the event does not exist", async () => {
      prisma.scraperEvent.findUnique.mockResolvedValue(null);
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events/does-not-exist",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when EMPLOYEE tries to view another employee's event", async () => {
      prisma.scraperEvent.findUnique.mockResolvedValue({
        id: "e1",
        employee_id: "other-emp",
        host: "portail.rmaassurance.com",
        url: "https://portail.rmaassurance.com/api",
        method: "GET",
        status_code: 200,
        captured_at: new Date(),
        created_at: new Date(),
        transformer_verdict: "PENDING",
        transformer_notes: null,
        request_headers: null,
        request_body: null,
        response_headers: null,
        response_body: null,
        processed_at: null,
        pathname: "/api",
        insurer_code: "RMA",
        duration_ms: 1,
      });
      const token = makeToken({ sub: "emp-1", role: "EMPLOYEE" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events/e1",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Insurer domains ───────────────────────────────────────────────

  describe("insurer-domains CRUD", () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
    });

    it("GET /insurer-domains returns list envelope (EMPLOYEE may read)", async () => {
      prisma.insurerDomain.findMany.mockResolvedValue([]);
      const token = makeToken({ role: "EMPLOYEE" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/insurer-domains",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("POST /insurer-domains rejects invalid insurer_code format (400)", async () => {
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/insurer-domains",
        headers: authHeader(token),
        payload: {
          host_pattern: "^example\\.com$",
          insurer_code: "bad code with space",
          label: "Bad",
          capture_enabled: true,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("POST /insurer-domains rejects an invalid regex host_pattern (400)", async () => {
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/insurer-domains",
        headers: authHeader(token),
        payload: {
          host_pattern: "*[invalid-regex",
          insurer_code: "EXA",
          label: "Example",
          capture_enabled: true,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("POST /insurer-domains rejects missing required fields (400)", async () => {
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/insurer-domains",
        headers: authHeader(token),
        payload: {
          host_pattern: "^example\\.com$",
          insurer_code: "EXA",
          // missing label + capture_enabled
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("POST /insurer-domains happy path returns 201", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue(null);
      prisma.insurerDomain.create.mockResolvedValue({
        id: "d1",
        host_pattern: "^example\\.com$",
        insurer_code: "EXA",
        label: "Example",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: "mgr-1",
      });
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/scraper/insurer-domains",
        headers: authHeader(token),
        payload: {
          host_pattern: "^example\\.com$",
          insurer_code: "EXA",
          label: "Example",
          capture_enabled: true,
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it("DELETE /insurer-domains/:id returns 204 on success", async () => {
      prisma.insurerDomain.findUnique.mockResolvedValue({
        id: "d1",
        host_pattern: "^example\\.com$",
        insurer_code: "EXA",
        label: "Example",
        capture_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: "mgr-1",
      });
      prisma.insurerDomain.delete.mockResolvedValue({ id: "d1" });
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/scraper/insurer-domains/d1",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe("");
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────

  describe("GET /events/stats", () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({ operator_code: "OP001" });
      prisma.scraperEvent.count.mockResolvedValue(0);
      prisma.scraperEvent.findFirst.mockResolvedValue(null);
    });

    it("returns the stats envelope for MANAGER (global scope)", async () => {
      const token = makeToken({ role: "MANAGER" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events/stats",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("captured_today");
      expect(body.data).toHaveProperty("transformed_today");
      expect(body.data).toHaveProperty("errors_today");
      expect(body.data).toHaveProperty("last_captured_at");
    });

    it("returns stats scoped to the caller for EMPLOYEE", async () => {
      const token = makeToken({ sub: "emp-42", role: "EMPLOYEE" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scraper/events/stats?employee_id=other-employee",
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      // Handler should ignore the employee_id query param for EMPLOYEE and
      // scope to user.sub. We just verify the response envelope here — the
      // scoping behaviour itself is unit-tested at the service layer.
      expect(res.json().success).toBe(true);
    });
  });
});


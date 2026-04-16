import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate } from "../../src/middleware/validate.js";

// Helper to create mock request/reply objects matching Fastify shape
function createMockRequest(body?: unknown, query?: unknown) {
  return {
    body,
    query: query ?? {},
    headers: {},
  } as any;
}

function createMockReply() {
  const reply: any = {
    _statusCode: 200,
    _body: null,
    code(status: number) {
      reply._statusCode = status;
      return reply;
    },
    send(body: unknown) {
      reply._body = body;
      return reply;
    },
  };
  return reply;
}

describe("validate middleware", () => {
  const testSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
  });

  describe("body validation (default)", () => {
    it("should pass valid body and replace with parsed data", async () => {
      const handler = validate(testSchema);
      const request = createMockRequest({ email: "test@test.com", name: "John", extra: "field" });
      const reply = createMockReply();

      await handler(request, reply);

      // The body should be replaced with parsed (cleaned) data
      expect(request.body).toEqual({ email: "test@test.com", name: "John" });
      // No error response sent
      expect(reply._body).toBeNull();
    });

    it("should return 400 for invalid body", async () => {
      const handler = validate(testSchema);
      const request = createMockRequest({ email: "not-email", name: "" });
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply._statusCode).toBe(400);
      expect(reply._body.success).toBe(false);
      expect(reply._body.error.code).toBe("VALIDATION_ERROR");
      expect(reply._body.error.message).toBe("Donnees de requete invalides.");
      expect(reply._body.error.details).toBeInstanceOf(Array);
      expect(reply._body.error.details.length).toBeGreaterThan(0);
    });

    it("should return 400 for null body", async () => {
      const handler = validate(testSchema);
      const request = createMockRequest(null);
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply._statusCode).toBe(400);
      expect(reply._body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for undefined body", async () => {
      const handler = validate(testSchema);
      const request = createMockRequest(undefined);
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply._statusCode).toBe(400);
    });

    it("should include path info in error details", async () => {
      const handler = validate(testSchema);
      const request = createMockRequest({ email: "bad", name: "a" });
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply._statusCode).toBe(400);
      const paths = reply._body.error.details.map((d: any) => d.path);
      expect(paths).toContain("email");
    });
  });

  describe("querystring validation", () => {
    it("should validate querystring when source='querystring'", async () => {
      const querySchema = z.object({ page: z.coerce.number().positive() });
      const handler = validate(querySchema, "querystring");
      const request = createMockRequest(undefined, { page: "5" });
      const reply = createMockReply();

      await handler(request, reply);

      expect(request.query).toEqual({ page: 5 });
      expect(reply._body).toBeNull();
    });

    it("should return 400 for invalid querystring", async () => {
      const querySchema = z.object({ page: z.coerce.number().positive() });
      const handler = validate(querySchema, "querystring");
      const request = createMockRequest(undefined, { page: "abc" });
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply._statusCode).toBe(400);
      expect(reply._body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("re-throws non-ZodError exceptions", () => {
    it("should re-throw if the schema transform throws a generic Error", async () => {
      const badSchema = z.object({}).transform(() => {
        throw new Error("unexpected error");
      });
      const handler = validate(badSchema);
      const request = createMockRequest({});
      const reply = createMockReply();

      await expect(handler(request, reply)).rejects.toThrow("unexpected error");
    });
  });
});

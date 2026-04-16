import { describe, it, expect } from "vitest";
import { authorize } from "../../src/middleware/authorize.js";

function createMockRequest(user?: { sub: string; email: string; role: string }) {
  return { user } as any;
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

describe("authorize middleware", () => {
  it("should allow user with matching role", async () => {
    const handler = authorize("MANAGER");
    const request = createMockRequest({ sub: "u1", email: "a@b.com", role: "MANAGER" });
    const reply = createMockReply();

    await handler(request, reply);

    expect(reply._body).toBeNull(); // No error sent
  });

  it("should allow user when role matches one of multiple allowed roles", async () => {
    const handler = authorize("MANAGER", "EMPLOYEE");
    const request = createMockRequest({ sub: "u1", email: "a@b.com", role: "EMPLOYEE" });
    const reply = createMockReply();

    await handler(request, reply);

    expect(reply._body).toBeNull();
  });

  it("should return 403 when user role is not in allowed list", async () => {
    const handler = authorize("MANAGER");
    const request = createMockRequest({ sub: "u1", email: "a@b.com", role: "EMPLOYEE" });
    const reply = createMockReply();

    await handler(request, reply);

    expect(reply._statusCode).toBe(403);
    expect(reply._body.error.code).toBe("AUTH_INSUFFICIENT_ROLE");
  });

  it("should return 401 when no user is attached to request", async () => {
    const handler = authorize("MANAGER");
    const request = createMockRequest(undefined);
    const reply = createMockReply();

    await handler(request, reply);

    expect(reply._statusCode).toBe(401);
    expect(reply._body.error.code).toBe("AUTH_TOKEN_MISSING");
  });

  it("should return 401 when request.user is null", async () => {
    const handler = authorize("MANAGER");
    const request = { user: null } as any;
    const reply = createMockReply();

    await handler(request, reply);

    expect(reply._statusCode).toBe(401);
  });
});

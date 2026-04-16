import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate } from "../../src/middleware/authenticate.js";
import { signAccessToken } from "../../src/utils/token.js";

function createMockRequest(authHeader?: string) {
  return {
    headers: {
      authorization: authHeader,
    },
    user: undefined as any,
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

describe("authenticate middleware", () => {
  it("should extract and verify a valid Bearer token", async () => {
    const token = signAccessToken({
      sub: "user-123",
      email: "test@example.com",
      role: "MANAGER",
    });
    const request = createMockRequest(`Bearer ${token}`);
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(request.user).toBeDefined();
    expect(request.user.sub).toBe("user-123");
    expect(request.user.email).toBe("test@example.com");
    expect(request.user.role).toBe("MANAGER");
    expect(reply._body).toBeNull();
  });

  it("should return 401 AUTH_TOKEN_MISSING when no Authorization header", async () => {
    const request = createMockRequest(undefined);
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply._statusCode).toBe(401);
    expect(reply._body.error.code).toBe("AUTH_TOKEN_MISSING");
  });

  it("should return 401 AUTH_TOKEN_MISSING for non-Bearer scheme", async () => {
    const request = createMockRequest("Basic abc123");
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply._statusCode).toBe(401);
    expect(reply._body.error.code).toBe("AUTH_TOKEN_MISSING");
  });

  it("should return 401 AUTH_TOKEN_INVALID for invalid JWT", async () => {
    const request = createMockRequest("Bearer invalid.jwt.token");
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply._statusCode).toBe(401);
    expect(reply._body.error.code).toBe("AUTH_TOKEN_INVALID");
  });

  it("should return 401 AUTH_TOKEN_MISSING for empty Authorization header", async () => {
    const request = createMockRequest("");
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply._statusCode).toBe(401);
    expect(reply._body.error.code).toBe("AUTH_TOKEN_MISSING");
  });

  it("should return 401 AUTH_TOKEN_INVALID for Bearer with empty token string", async () => {
    const request = createMockRequest("Bearer ");
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply._statusCode).toBe(401);
    // Bearer followed by space but empty token should fail verification
    expect(reply._body.error.code).toBe("AUTH_TOKEN_INVALID");
  });
});

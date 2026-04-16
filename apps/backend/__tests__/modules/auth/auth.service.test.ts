import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, refresh, logout, cleanExpiredTokens } from "../../../src/modules/auth/auth.service.js";
import { hashPassword } from "../../../src/utils/password.js";

// Create a mock PrismaClient
function createMockPrisma() {
  return {
    employee: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as any;
}

// Helper to create a mock employee record
function createMockEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp-1",
    email: "user@test.com",
    full_name: "Test User",
    role: "EMPLOYEE",
    operator_code: "int12345",
    is_active: true,
    password_hash: "", // will be set per test
    ...overrides,
  };
}

describe("auth.service", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  describe("login", () => {
    it("should return tokens and user data for valid credentials", async () => {
      const password = "validpassword";
      const hash = await hashPassword(password);
      const employee = createMockEmployee({ password_hash: hash });

      prisma.employee.findUnique.mockResolvedValue(employee);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await login(prisma, "user@test.com", password);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result.user.id).toBe("emp-1");
      expect(result.user.email).toBe("user@test.com");
      expect(result.user.full_name).toBe("Test User");
      expect(result.user.role).toBe("EMPLOYEE");
      expect(result.user.operator_code).toBe("int12345");
      expect(typeof result.access_token).toBe("string");
      expect(typeof result.refresh_token).toBe("string");
    });

    it("should throw AUTH_INVALID_CREDENTIALS when employee not found", async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(login(prisma, "unknown@test.com", "password"))
        .rejects.toMatchObject({
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS",
        });
    });

    it("should throw AUTH_ACCOUNT_DISABLED when employee is inactive", async () => {
      const hash = await hashPassword("password123");
      const employee = createMockEmployee({ is_active: false, password_hash: hash });
      prisma.employee.findUnique.mockResolvedValue(employee);

      await expect(login(prisma, "user@test.com", "password123"))
        .rejects.toMatchObject({
          statusCode: 401,
          code: "AUTH_ACCOUNT_DISABLED",
        });
    });

    it("should throw AUTH_INVALID_CREDENTIALS for wrong password", async () => {
      const hash = await hashPassword("correctpassword");
      const employee = createMockEmployee({ password_hash: hash });
      prisma.employee.findUnique.mockResolvedValue(employee);

      await expect(login(prisma, "user@test.com", "wrongpassword"))
        .rejects.toMatchObject({
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS",
        });
    });

    it("should store the refresh token hash in the database", async () => {
      const password = "validpassword";
      const hash = await hashPassword(password);
      const employee = createMockEmployee({ password_hash: hash });

      prisma.employee.findUnique.mockResolvedValue(employee);
      prisma.refreshToken.create.mockResolvedValue({});

      await login(prisma, "user@test.com", password);

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.employee_id).toBe("emp-1");
      expect(createCall.data.token_hash).toBeDefined();
      expect(createCall.data.expires_at).toBeInstanceOf(Date);
    });
  });

  describe("refresh", () => {
    it("should throw AUTH_REFRESH_INVALID when no matching token found", async () => {
      prisma.refreshToken.findMany.mockResolvedValue([]);

      await expect(refresh(prisma, "nonexistent-token"))
        .rejects.toMatchObject({
          statusCode: 401,
          code: "AUTH_REFRESH_INVALID",
        });
    });

    it("should throw AUTH_ACCOUNT_DISABLED if employee is inactive and revoke the token", async () => {
      // We need a real bcrypt hash that matches our test token
      const { hashRefreshToken } = await import("../../../src/utils/token.js");
      const rawToken = "test-refresh-token";
      const tokenHash = await hashRefreshToken(rawToken);

      const storedToken = {
        id: "rt-1",
        token_hash: tokenHash,
        is_revoked: false,
        expires_at: new Date(Date.now() + 3_600_000),
        employee: createMockEmployee({ is_active: false }),
      };

      prisma.refreshToken.findMany.mockResolvedValue([storedToken]);
      prisma.refreshToken.update.mockResolvedValue({});

      await expect(refresh(prisma, rawToken))
        .rejects.toMatchObject({
          statusCode: 401,
          code: "AUTH_ACCOUNT_DISABLED",
        });

      // Should have revoked the token
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { is_revoked: true },
      });
    });

    it("should rotate tokens and return new access + refresh tokens", async () => {
      const { hashRefreshToken } = await import("../../../src/utils/token.js");
      const rawToken = "test-refresh-token-rotate";
      const tokenHash = await hashRefreshToken(rawToken);

      const storedToken = {
        id: "rt-2",
        token_hash: tokenHash,
        is_revoked: false,
        expires_at: new Date(Date.now() + 3_600_000),
        employee: createMockEmployee({ is_active: true }),
      };

      prisma.refreshToken.findMany.mockResolvedValue([storedToken]);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await refresh(prisma, rawToken);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(typeof result.access_token).toBe("string");
      expect(typeof result.refresh_token).toBe("string");

      // Old token was revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-2" },
        data: { is_revoked: true },
      });

      // New token was created
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("logout", () => {
    it("should revoke a matching refresh token", async () => {
      const { hashRefreshToken } = await import("../../../src/utils/token.js");
      const rawToken = "test-logout-token";
      const tokenHash = await hashRefreshToken(rawToken);

      const storedToken = {
        id: "rt-3",
        token_hash: tokenHash,
        is_revoked: false,
        expires_at: new Date(Date.now() + 3_600_000),
      };

      prisma.refreshToken.findMany.mockResolvedValue([storedToken]);
      prisma.refreshToken.update.mockResolvedValue({});

      await logout(prisma, rawToken);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-3" },
        data: { is_revoked: true },
      });
    });

    it("should be idempotent when no matching token exists", async () => {
      prisma.refreshToken.findMany.mockResolvedValue([]);

      // Should not throw
      await expect(logout(prisma, "unknown-token")).resolves.toBeUndefined();
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe("cleanExpiredTokens", () => {
    it("should delete expired and revoked tokens", async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const count = await cleanExpiredTokens(prisma);
      expect(count).toBe(5);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
      const deleteCall = prisma.refreshToken.deleteMany.mock.calls[0][0];
      expect(deleteCall.where.OR).toHaveLength(2);
    });

    it("should return 0 when no tokens to clean", async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const count = await cleanExpiredTokens(prisma);
      expect(count).toBe(0);
    });
  });
});

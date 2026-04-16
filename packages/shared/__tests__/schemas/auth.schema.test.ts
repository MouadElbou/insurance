import { describe, it, expect } from "vitest";
import { loginSchema, refreshSchema } from "../../src/schemas/auth.schema.js";

describe("loginSchema", () => {
  it("should accept valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("should reject password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("password");
    }
  });

  it("should reject empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing fields", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("should accept exactly 8 character password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("should strip extra fields", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      extra: "should be removed",
    });
    expect(result.success).toBe(true);
  });
});

describe("refreshSchema", () => {
  it("should accept valid refresh token", () => {
    const result = refreshSchema.safeParse({
      refresh_token: "some-refresh-token-value",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty refresh token", () => {
    const result = refreshSchema.safeParse({
      refresh_token: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing refresh_token field", () => {
    const result = refreshSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

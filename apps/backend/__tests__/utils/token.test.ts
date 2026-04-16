import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
  parseDurationMs,
} from "../../src/utils/token.js";

describe("token utils", () => {
  describe("signAccessToken / verifyAccessToken", () => {
    it("should sign and verify a valid token", () => {
      const payload = { sub: "user-123", email: "test@test.com", role: "MANAGER" as const };
      const token = signAccessToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe("user-123");
      expect(decoded.email).toBe("test@test.com");
      expect(decoded.role).toBe("MANAGER");
    });

    it("should throw for an invalid token string", () => {
      expect(() => verifyAccessToken("invalid.token.here")).toThrow();
    });

    it("should throw for a tampered token", () => {
      const token = signAccessToken({ sub: "user-1", email: "a@b.com", role: "EMPLOYEE" as const });
      // Tamper with the payload section
      const parts = token.split(".");
      parts[1] = parts[1] + "tampered";
      expect(() => verifyAccessToken(parts.join("."))).toThrow();
    });

    it("should throw for an empty string token", () => {
      expect(() => verifyAccessToken("")).toThrow();
    });
  });

  describe("generateRefreshToken", () => {
    it("should return a UUID string", () => {
      const token = generateRefreshToken();
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate unique tokens on each call", () => {
      const tokens = new Set(Array.from({ length: 10 }, () => generateRefreshToken()));
      expect(tokens.size).toBe(10);
    });
  });

  describe("hashRefreshToken / compareRefreshToken", () => {
    it("should hash and compare correctly", async () => {
      const token = "my-refresh-token-value";
      const hash = await hashRefreshToken(token);
      expect(typeof hash).toBe("string");
      expect(hash).not.toBe(token);

      const match = await compareRefreshToken(token, hash);
      expect(match).toBe(true);
    });

    it("should fail comparison for wrong token", async () => {
      const hash = await hashRefreshToken("correct-token");
      const match = await compareRefreshToken("wrong-token", hash);
      expect(match).toBe(false);
    });
  });

  describe("parseDurationMs", () => {
    it("should parse seconds", () => {
      expect(parseDurationMs("30s")).toBe(30_000);
      expect(parseDurationMs("1s")).toBe(1_000);
    });

    it("should parse minutes", () => {
      expect(parseDurationMs("15m")).toBe(15 * 60 * 1000);
      expect(parseDurationMs("1m")).toBe(60_000);
    });

    it("should parse hours", () => {
      expect(parseDurationMs("1h")).toBe(3_600_000);
      expect(parseDurationMs("24h")).toBe(86_400_000);
    });

    it("should parse days", () => {
      expect(parseDurationMs("7d")).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDurationMs("1d")).toBe(86_400_000);
    });

    it("should throw for invalid format", () => {
      expect(() => parseDurationMs("")).toThrow("Invalid duration format");
      expect(() => parseDurationMs("abc")).toThrow("Invalid duration format");
      expect(() => parseDurationMs("15")).toThrow("Invalid duration format");
      expect(() => parseDurationMs("15x")).toThrow("Invalid duration format");
      expect(() => parseDurationMs("m15")).toThrow("Invalid duration format");
    });

    it("should throw for negative or zero-like invalid strings", () => {
      expect(() => parseDurationMs("-1d")).toThrow("Invalid duration format");
    });
  });
});

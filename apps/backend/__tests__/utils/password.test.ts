import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/utils/password.js";

describe("password utils", () => {
  describe("hashPassword", () => {
    it("should return a bcrypt hash string", async () => {
      const hash = await hashPassword("testpassword123");
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    });

    it("should produce different hashes for different passwords", async () => {
      const hash1 = await hashPassword("password1");
      const hash2 = await hashPassword("password2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hashes for the same password (unique salts)", async () => {
      const hash1 = await hashPassword("samepassword");
      const hash2 = await hashPassword("samepassword");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for matching password and hash", async () => {
      const password = "mysecretpassword";
      const hash = await hashPassword(password);
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it("should return false for non-matching password", async () => {
      const hash = await hashPassword("correctpassword");
      const result = await verifyPassword("wrongpassword", hash);
      expect(result).toBe(false);
    });

    it("should return false for empty password against a hash", async () => {
      const hash = await hashPassword("notempty");
      const result = await verifyPassword("", hash);
      expect(result).toBe(false);
    });
  });
});

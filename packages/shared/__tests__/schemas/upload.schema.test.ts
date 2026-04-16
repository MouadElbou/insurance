import { describe, it, expect } from "vitest";
import { uploadQuerySchema } from "../../src/schemas/upload.schema.js";

describe("uploadQuerySchema", () => {
  it("should apply defaults when no fields provided", () => {
    const result = uploadQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(25);
      expect(result.data.status).toBeUndefined();
    }
  });

  it("should accept valid status values", () => {
    for (const status of ["PENDING", "PROCESSING", "COMPLETED", "FAILED"]) {
      const result = uploadQuerySchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid status", () => {
    const result = uploadQuerySchema.safeParse({ status: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("should coerce string page to number", () => {
    const result = uploadQuerySchema.safeParse({ page: "3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });

  it("should reject per_page over 100", () => {
    const result = uploadQuerySchema.safeParse({ per_page: "150" });
    expect(result.success).toBe(false);
  });

  it("should reject page 0", () => {
    const result = uploadQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("should reject negative page", () => {
    const result = uploadQuerySchema.safeParse({ page: "-1" });
    expect(result.success).toBe(false);
  });
});

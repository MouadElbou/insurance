import { describe, it, expect } from "vitest";
import { formatMAD } from "../../src/utils/currency.js";

describe("formatMAD (shared)", () => {
  it("should format a positive number", () => {
    const result = formatMAD(12345.67);
    expect(result).toMatch(/12.345,67 MAD/);
  });

  it("should format zero", () => {
    expect(formatMAD(0)).toMatch(/0,00 MAD/);
  });

  it("should format a string number", () => {
    const result = formatMAD("9876.54");
    expect(result).toMatch(/9.876,54 MAD/);
  });

  it("should return '0,00 MAD' for null", () => {
    expect(formatMAD(null)).toBe("0,00 MAD");
  });

  it("should return '0,00 MAD' for undefined", () => {
    expect(formatMAD(undefined)).toBe("0,00 MAD");
  });

  it("should return '0,00 MAD' for non-numeric string", () => {
    expect(formatMAD("abc")).toBe("0,00 MAD");
  });

  it("should handle large numbers", () => {
    const result = formatMAD(1000000);
    expect(result).toContain("MAD");
    expect(result).toContain("000");
  });

  it("should handle negative numbers", () => {
    const result = formatMAD(-500.25);
    expect(result).toContain("MAD");
    expect(result).toContain("500");
  });
});

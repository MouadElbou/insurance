import { describe, it, expect } from "vitest";
import { formatMAD } from "../../src/utils/currency.js";

describe("formatMAD", () => {
  it("should format a positive number", () => {
    const result = formatMAD(12345.67);
    // fr-FR uses narrow no-break space (U+202F) as thousands separator
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

  it("should pad decimals to 2 places", () => {
    const result = formatMAD(5);
    expect(result).toMatch(/5,00 MAD/);
  });

  it("should handle negative numbers", () => {
    const result = formatMAD(-100.5);
    expect(result).toContain("MAD");
    expect(result).toContain("100");
  });
});

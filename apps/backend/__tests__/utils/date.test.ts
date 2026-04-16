import { describe, it, expect } from "vitest";
import { parseExcelDate, parseDecimalValue } from "../../src/utils/date.js";

describe("date utils", () => {
  describe("parseExcelDate", () => {
    it("should return undefined for null/undefined/empty", () => {
      expect(parseExcelDate(null)).toBeUndefined();
      expect(parseExcelDate(undefined)).toBeUndefined();
      expect(parseExcelDate("")).toBeUndefined();
    });

    it("should pass through a valid Date object", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = parseExcelDate(date);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBe(date.getTime());
    });

    it("should return undefined for an invalid Date object", () => {
      expect(parseExcelDate(new Date("invalid"))).toBeUndefined();
    });

    it("should convert Excel serial date numbers", () => {
      // Excel serial 44927 = 2023-01-01 (epoch 1899-12-30 + 44927 days)
      const result = parseExcelDate(44927);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getUTCFullYear()).toBe(2023);
      expect(result!.getUTCMonth()).toBe(0); // January
      expect(result!.getUTCDate()).toBe(1);
    });

    it("should return undefined for NaN number", () => {
      expect(parseExcelDate(NaN)).toBeUndefined();
    });

    it("should parse French dd/MM/yyyy format", () => {
      const result = parseExcelDate("15/03/2024");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(15);
      expect(result!.getMonth()).toBe(2); // March = 2
      expect(result!.getFullYear()).toBe(2024);
    });

    it("should parse single-digit day/month in French format", () => {
      const result = parseExcelDate("1/3/2024");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(1);
      expect(result!.getMonth()).toBe(2);
    });

    it("should parse ISO date string format", () => {
      const result = parseExcelDate("2024-03-15");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2024);
    });

    it("should return undefined for whitespace-only string", () => {
      expect(parseExcelDate("   ")).toBeUndefined();
    });

    it("should return undefined for unparseable string", () => {
      expect(parseExcelDate("not-a-date")).toBeUndefined();
    });

    it("should return undefined for non-date types like boolean", () => {
      expect(parseExcelDate(true)).toBeUndefined();
      expect(parseExcelDate(false)).toBeUndefined();
    });
  });

  describe("parseDecimalValue", () => {
    it("should return undefined for null/undefined/empty", () => {
      expect(parseDecimalValue(null)).toBeUndefined();
      expect(parseDecimalValue(undefined)).toBeUndefined();
      expect(parseDecimalValue("")).toBeUndefined();
    });

    it("should return number directly", () => {
      expect(parseDecimalValue(42.5)).toBe(42.5);
      expect(parseDecimalValue(0)).toBe(0);
      expect(parseDecimalValue(-10)).toBe(-10);
    });

    it("should return undefined for NaN number", () => {
      expect(parseDecimalValue(NaN)).toBeUndefined();
    });

    it("should parse plain numeric string", () => {
      expect(parseDecimalValue("1234.56")).toBe(1234.56);
    });

    it("should parse French formatted string (comma decimal, space thousands)", () => {
      expect(parseDecimalValue("12 345,67")).toBe(12345.67);
      expect(parseDecimalValue("1 000")).toBe(1000);
    });

    it("should handle formula result objects", () => {
      expect(parseDecimalValue({ result: 99.5 })).toBe(99.5);
      expect(parseDecimalValue({ result: "100,50" })).toBe(100.50);
    });

    it("should return undefined for non-numeric string", () => {
      expect(parseDecimalValue("abc")).toBeUndefined();
    });

    it("should return undefined for object without result property", () => {
      expect(parseDecimalValue({ foo: "bar" })).toBeUndefined();
    });
  });
});

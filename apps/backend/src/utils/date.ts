/**
 * Parse an Excel date value. Excel stores dates as serial numbers
 * (days since 1899-12-30) or as formatted strings.
 */
export function parseExcelDate(
  value: unknown,
): Date | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  // Already a Date object (exceljs sometimes returns Date directly)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    return value;
  }

  // Excel serial date number
  if (typeof value === "number") {
    // Excel epoch is 1899-12-30. Days are offset by 1 because Excel
    // erroneously treats 1900 as a leap year (Lotus 1-2-3 bug).
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + value * 24 * 60 * 60 * 1000;
    const result = new Date(ms);
    if (isNaN(result.getTime())) return undefined;
    return result;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;

    // Try dd/MM/yyyy format (French)
    const frMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (frMatch) {
      const [, day, month, year] = frMatch;
      const d = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
      );
      if (!isNaN(d.getTime())) return d;
    }

    // Try yyyy-MM-dd or ISO format
    const iso = new Date(trimmed);
    if (!isNaN(iso.getTime())) return iso;

    return undefined;
  }

  return undefined;
}

/**
 * Parse a decimal value from an Excel cell. Handles numbers, strings,
 * and formula results. Returns the numeric value or undefined.
 */
export function parseDecimalValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value === "number") {
    return isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    // Remove spaces and replace comma with period (French formatting)
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }
  // exceljs CellValue can be an object with `result` property (formula cells)
  if (typeof value === "object" && value !== null && "result" in value) {
    return parseDecimalValue((value as { result: unknown }).result);
  }
  return undefined;
}

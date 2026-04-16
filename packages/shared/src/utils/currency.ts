/**
 * Format a number or string as MAD currency.
 * Example: formatMAD("12345.67") => "12 345,67 MAD"
 */
export function formatMAD(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0,00 MAD";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0,00 MAD";
  const formatted = num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} MAD`;
}

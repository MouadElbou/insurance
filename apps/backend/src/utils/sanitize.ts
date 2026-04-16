/**
 * Escape HTML entities to prevent stored XSS.
 * Applied to user-controlled string fields before persistence.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitize a value if it is a non-empty string, otherwise return it unchanged.
 */
export function sanitizeOptional(value: string | null | undefined): string | null | undefined {
  if (typeof value === "string" && value.length > 0) {
    return sanitizeHtml(value);
  }
  return value;
}

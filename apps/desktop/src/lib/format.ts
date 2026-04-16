import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { formatMAD } from "@insurance/shared";

export function formatCurrency(
  value: string | number | null | undefined,
): string {
  return formatMAD(value);
}

function toDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return isValid(date) ? date : null;
  try {
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "-";
  return format(d, "dd/MM/yyyy", { locale: fr });
}

export function formatDateTime(
  date: string | Date | null | undefined,
): string {
  const d = toDate(date);
  if (!d) return "-";
  return format(d, "dd/MM/yyyy HH:mm", { locale: fr });
}

export function formatRelativeTime(
  date: string | Date | null | undefined,
): string {
  const d = toDate(date);
  if (!d) return "-";
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  OPERATION_TYPE_LABELS,
  OPERATION_SOURCE_LABELS,
  UPLOAD_STATUS_LABELS,
} from "@/lib/constants";

type StatusVariant =
  | "PRODUCTION"
  | "EMISSION"
  | "EXCEL"
  | "MANUAL"
  | "SCRAPER"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "online"
  | "idle"
  | "offline";

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  PRODUCTION: "bg-primary-fixed/40 text-primary-container",
  EMISSION: "bg-tertiary-container/20 text-tertiary",
  EXCEL: "bg-secondary-container/30 text-secondary-m3",
  MANUAL: "bg-primary-fixed/40 text-primary-container",
  SCRAPER: "bg-surface-container text-on-surface-variant",
  PENDING: "bg-surface-container text-on-surface-variant",
  PROCESSING: "bg-primary-fixed/40 text-primary-container",
  COMPLETED: "bg-secondary-container/30 text-secondary-m3",
  FAILED: "bg-error-container text-error-m3",
  online: "bg-secondary-container/30 text-secondary-m3",
  idle: "bg-tertiary-container/20 text-tertiary",
  offline: "bg-surface-container text-on-surface-variant",
};

const allLabels: Record<string, string> = {
  ...OPERATION_TYPE_LABELS,
  ...OPERATION_SOURCE_LABELS,
  ...UPLOAD_STATUS_LABELS,
  online: "En ligne",
  idle: "Inactif",
  offline: "Hors ligne",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "text-[10px] font-semibold tracking-wide border-transparent",
        variantStyles[status] || "bg-surface-container text-on-surface-variant",
        className,
      )}
    >
      {allLabels[status] || status}
    </Badge>
  );
}

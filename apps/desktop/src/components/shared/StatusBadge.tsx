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
  PRODUCTION:
    "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  EMISSION:
    "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  EXCEL: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  MANUAL: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  SCRAPER: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  PENDING: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",
  PROCESSING:
    "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  FAILED: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  online: "bg-green-50 text-green-700 border-green-200",
  idle: "bg-yellow-50 text-yellow-700 border-yellow-200",
  offline: "bg-gray-50 text-gray-500 border-gray-200",
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
      variant="outline"
      className={cn(
        "text-xs font-medium border transition-colors",
        variantStyles[status] || "bg-gray-50 text-gray-600 border-gray-200",
        className,
      )}
    >
      {allLabels[status] || status}
    </Badge>
  );
}

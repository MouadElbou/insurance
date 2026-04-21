import { Activity, AlertCircle, CircleDot, Loader2, Power } from "lucide-react";
import type { CaptureStatus } from "@insurance/shared";
import { cn } from "@/lib/utils";
import {
  CAPTURE_STATUS_COLORS,
  CAPTURE_STATUS_LABELS,
} from "@/lib/constants";

interface CaptureStatusBadgeProps {
  status: CaptureStatus;
  className?: string;
  size?: "sm" | "md";
}

const ICONS: Record<CaptureStatus, typeof Activity> = {
  IDLE: Power,
  OPENING: Loader2,
  OPEN: CircleDot,
  CAPTURING: Activity,
  CLOSED: Power,
  ERROR: AlertCircle,
};

/**
 * Small coloured pill that communicates the current capture state of the
 * WebContentsView portal. Used in the toolbar and in the sidebar of the
 * PortalPage.
 */
export function CaptureStatusBadge({
  status,
  className,
  size = "md",
}: CaptureStatusBadgeProps) {
  const Icon = ICONS[status] ?? Power;
  const label = CAPTURE_STATUS_LABELS[status] ?? status;
  const colors = CAPTURE_STATUS_COLORS[status] ?? "";
  const isSpinning = status === "OPENING";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        colors,
        size === "sm"
          ? "px-2 py-0.5 text-[10px] tracking-wide uppercase"
          : "px-3 py-1 text-xs tracking-wide",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={cn(
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          isSpinning && "animate-spin",
          status === "CAPTURING" && "animate-pulse",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

import { Activity, Clock, Power, RefreshCw, TriangleAlert } from "lucide-react";
import type { PortalStatus, ScraperEventStats } from "@insurance/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { CaptureStatusBadge } from "./CaptureStatusBadge";

interface PortalToolbarProps {
  status: PortalStatus;
  stats: ScraperEventStats | null;
  onClose: () => void | Promise<void>;
  onRefreshStats?: () => void | Promise<void>;
  isClosing?: boolean;
}

/**
 * Slim header above the portal viewport. Shows live capture state, which
 * insurer is currently loaded, per-session counters, daily stats, and the
 * primary "close portal" control.
 */
export function PortalToolbar({
  status,
  stats,
  onClose,
  onRefreshStats,
  isClosing,
}: PortalToolbarProps) {
  // Status comes from main over IPC; we trust it, but a malformed URL
  // would throw and take the whole toolbar down with it. Fall back to
  // the raw string so the operator can still see *something* if main
  // ever ships a non-URL (e.g. `about:blank`).
  const hostLabel = (() => {
    if (!status.url) return status.insurer_code ?? "Aucun portail";
    try {
      return new URL(status.url).host;
    } catch {
      return status.url;
    }
  })();
  const isActive = status.status === "OPEN" || status.status === "CAPTURING";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4 min-w-0">
        <CaptureStatusBadge status={status.status} />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-outline">
            Portail actif
          </span>
          <span className="truncate text-sm font-semibold text-on-surface">
            {hostLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
        <Metric
          icon={Activity}
          label="Capturés (session)"
          value={status.captured_count.toLocaleString("fr-FR")}
          accent="text-primary"
        />
        <Metric
          icon={Clock}
          label="Dernier envoi"
          value={
            status.last_flush_at
              ? formatRelativeTime(status.last_flush_at)
              : "—"
          }
        />
        <Metric
          icon={Activity}
          label="Aujourd'hui"
          value={
            stats
              ? `${stats.captured_today.toLocaleString("fr-FR")} capturés`
              : "—"
          }
        />
        {stats && stats.errors_today > 0 ? (
          <Metric
            icon={TriangleAlert}
            label="Erreurs"
            value={stats.errors_today.toLocaleString("fr-FR")}
            accent="text-error"
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {onRefreshStats ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRefreshStats()}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Rafraîchir</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant={isActive ? "destructive" : "outline"}
          size="sm"
          onClick={() => onClose()}
          disabled={!isActive || isClosing}
          className="gap-2"
        >
          <Power className="h-3.5 w-3.5" aria-hidden />
          <span>Fermer</span>
        </Button>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-outline" aria-hidden />
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">
          {label}
        </span>
        <span
          className={cn(
            "text-sm font-semibold text-on-surface mt-0.5",
            accent,
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

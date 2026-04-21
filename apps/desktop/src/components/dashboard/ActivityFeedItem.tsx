import type { ActivityItem } from "@insurance/shared";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface ActivityFeedItemProps {
  item: ActivityItem;
}

const STATUS_CONFIG: Record<
  string,
  {
    icon: typeof CheckCircle2;
    iconBg: string;
    badgeClass: string;
    badgeLabel: string;
    titleAction: string;
  }
> = {
  PRODUCTION: {
    icon: CheckCircle2,
    iconBg: "bg-secondary-container/20 text-secondary",
    badgeClass: "bg-secondary-container text-on-secondary-container",
    badgeLabel: "Validé",
    titleAction: "validée",
  },
  EMISSION: {
    icon: Clock,
    iconBg: "bg-tertiary-container/20 text-tertiary-container",
    badgeClass: "bg-tertiary-container text-on-tertiary-container",
    badgeLabel: "En attente",
    titleAction: "en attente",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  EXCEL: "Excel",
  MANUAL: "Manuel",
  SCRAPER: "Scraper",
};

const DEFAULT_STATUS = {
  icon: AlertCircle,
  iconBg: "bg-error-container/20 text-error",
  badgeClass: "bg-error-container text-on-error-container",
  badgeLabel: "Erreur",
  titleAction: "erreur",
};

export function ActivityFeedItem({ item }: ActivityFeedItemProps) {
  const config = STATUS_CONFIG[item.operation_type] ?? DEFAULT_STATUS;
  const Icon = config.icon;

  const title = item.policy_number
    ? `Police #${item.policy_number} ${config.titleAction}`
    : `Opération ${config.titleAction}`;

  const shortName = item.employee_name
    .split(" ")
    .map((n, i) => (i === 0 ? n : `${n[0]}.`))
    .join(" ");
  const description = item.client_name
    ? `${shortName} — ${item.client_name}`
    : shortName;

  return (
    <div className="px-6 py-4 flex items-start gap-4 hover:bg-surface-container-low transition-colors">
      <div
        className={cn(
          "mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          config.iconBg,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h5 className="text-sm font-bold">{title}</h5>
          <span className="text-[10px] text-outline font-medium shrink-0 ml-2">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">{description}</p>
        <div className="flex gap-2 mt-2">
          <span
            className={cn(
              "px-2 py-0.5 text-[9px] font-bold rounded uppercase",
              config.badgeClass,
            )}
          >
            {config.badgeLabel}
          </span>
          <span className="px-2 py-0.5 bg-surface-container text-outline text-[9px] font-bold rounded uppercase">
            {SOURCE_LABELS[item.source] ?? item.source}
          </span>
        </div>
      </div>
    </div>
  );
}

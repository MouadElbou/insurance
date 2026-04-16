import type { ActivityItem } from "@insurance/shared";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ActivityFeedItemProps {
  item: ActivityItem;
  isNew?: boolean;
}

export function ActivityFeedItem({ item, isNew = false }: ActivityFeedItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors",
        "hover:bg-muted/40",
        isNew && "bg-primary/5 animate-slide-down",
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {item.employee_name}
          </span>
          <StatusBadge status={item.operation_type} />
          <StatusBadge status={item.source} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{item.policy_number}</span>
          {item.client_name && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="truncate">{item.client_name}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1">
        {item.prime_net && (
          <CurrencyDisplay value={item.prime_net} size="sm" />
        )}
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(item.created_at)}
        </span>
      </div>
    </div>
  );
}

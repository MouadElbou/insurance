import type { EmployeePresence } from "@insurance/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PRESENCE_COLORS, PRESENCE_LABELS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PresenceIndicatorProps {
  presence: EmployeePresence;
}

export function PresenceIndicator({ presence }: PresenceIndicatorProps) {
  const initials = presence.employee_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const dotColor = PRESENCE_COLORS[presence.status] || PRESENCE_COLORS.offline;
  const statusLabel = PRESENCE_LABELS[presence.status] || presence.status;
  const isOffline = presence.status === "offline";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors cursor-default",
            isOffline && "opacity-60",
          )} />
        }
      >
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium bg-surface-container text-on-surface-variant">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest",
              dotColor,
              presence.status === "online" && "animate-pulse",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">
            {presence.employee_name}
          </p>
          <p className="text-[10px] text-on-surface-variant">{statusLabel}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <div className="text-xs">
          <p className="font-medium">{presence.employee_name}</p>
          <p className="text-on-surface-variant">
            {statusLabel}
            {presence.last_heartbeat
              ? ` - ${formatRelativeTime(presence.last_heartbeat)}`
              : ""}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

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

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-default" />
        }
      >
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium bg-muted">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
              dotColor,
              presence.status === "online" && "animate-pulse",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {presence.employee_name}
          </p>
          <p className="text-[10px] text-muted-foreground">{statusLabel}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <div className="text-xs">
          <p className="font-medium">{presence.employee_name}</p>
          <p className="text-muted-foreground">
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

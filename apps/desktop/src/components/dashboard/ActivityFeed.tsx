import type { ActivityItem } from "@insurance/shared";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading: boolean;
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border bg-card animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Activite recente</h3>
        {!isLoading && items.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {items.length} element{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Aucune activite"
          description="Les nouvelles operations apparaitront ici en temps reel."
          className="py-10"
        />
      ) : (
        <ScrollArea className="h-[400px]">
          {items.map((item, index) => (
            <ActivityFeedItem
              key={item.id}
              item={item}
              isNew={index === 0}
            />
          ))}
        </ScrollArea>
      )}
    </div>
  );
}

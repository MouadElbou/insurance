import type { ActivityItem } from "@insurance/shared";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, Activity } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading: boolean;
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col">
      <div className="p-6 border-b border-outline-variant/15 flex items-center justify-between">
        <h4 className="text-sm font-bold text-outline uppercase tracking-widest">
          Activités Récentes
        </h4>
        <button className="p-1 hover:bg-surface-container rounded-md">
          <MoreVertical className="h-4 w-4 text-outline" />
        </button>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 px-6 py-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Aucune activité"
          description="Les nouvelles opérations apparaîtront ici en temps réel."
          className="py-10"
        />
      ) : (
        <div
          className="flex-1 overflow-y-auto max-h-[280px]"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item) => (
            <ActivityFeedItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

import type { EmployeePresence } from "@insurance/shared";
import { PresenceIndicator } from "./PresenceIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { useMemo } from "react";

interface PresencePanelProps {
  presenceMap: Map<string, EmployeePresence>;
  isLoading: boolean;
}

export function PresencePanel({ presenceMap, isLoading }: PresencePanelProps) {
  const sortedPresence = useMemo(() => {
    const list = Array.from(presenceMap.values());
    const order = { online: 0, idle: 1, offline: 2 };
    return list.sort(
      (a, b) =>
        (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
        a.employee_name.localeCompare(b.employee_name),
    );
  }, [presenceMap]);

  const onlineCount = useMemo(
    () => sortedPresence.filter((p) => p.status === "online").length,
    [sortedPresence],
  );

  return (
    <div className="rounded-xl border bg-card animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Equipe</h3>
        {!isLoading && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {onlineCount} en ligne
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedPresence.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Users className="h-6 w-6 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">Aucun employe</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {sortedPresence.map((p) => (
              <PresenceIndicator key={p.employee_id} presence={p} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

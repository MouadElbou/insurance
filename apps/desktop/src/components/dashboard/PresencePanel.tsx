import type { EmployeePresence } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

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

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
      <h4 className="text-sm font-bold text-outline mb-6 uppercase tracking-widest">
        Équipe en ligne
      </h4>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedPresence.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Users className="h-6 w-6 text-on-surface-variant/40 mb-2" />
          <p className="text-xs text-on-surface-variant">Aucun employé</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPresence.map((p) => {
            const isOffline = p.status === "offline";
            return (
              <div
                key={p.employee_id}
                className={cn(
                  "flex items-center gap-3",
                  isOffline && "opacity-60",
                )}
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                    {initials(p.employee_name)}
                  </div>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-2 h-2 border border-white rounded-full",
                      isOffline ? "bg-outline" : "bg-secondary",
                    )}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold">{p.employee_name}</p>
                  <p className="text-[9px] text-outline font-medium">
                    {isOffline ? "Hors ligne" : "En ligne"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

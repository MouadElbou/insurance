import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OperationStats } from "@insurance/shared";

export function useEmployeeBulkStats() {
  const [statsMap, setStatsMap] = useState<Record<string, OperationStats>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const data = await api.get<Record<string, OperationStats>>(
          "employees/bulk-stats",
        );
        if (!cancelled) setStatsMap(data);
      } catch {
        // silently fail — cards just won't show stats
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { statsMap, isLoading };
}

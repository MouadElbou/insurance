import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { OperationStats } from "@insurance/shared";
import { toast } from "sonner";

export function useOperationStats() {
  const [stats, setStats] = useState<OperationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<OperationStats>("operations/stats");
      setStats(data);
    } catch {
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}

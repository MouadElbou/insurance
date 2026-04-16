import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useSocket } from "./useSocket";
import type {
  KpiData,
  ActivityItem,
  EmployeePresence,
} from "@insurance/shared";
import { toast } from "sonner";

export function useDashboard() {
  const {
    kpis,
    activityFeed,
    presenceMap,
    isLoading,
    setKpis,
    setActivityFeed,
    setPresenceList,
    setLoading,
  } = useDashboardStore();
  const { joinDashboard, leaveDashboard } = useSocket();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiData, activity, presence] = await Promise.all([
        api.get<KpiData>("dashboard/kpis"),
        api.get<ActivityItem[]>("dashboard/activity"),
        api.get<EmployeePresence[]>("dashboard/presence"),
      ]);
      setKpis(kpiData);
      setActivityFeed(activity);
      setPresenceList(presence);
    } catch {
      toast.error("Erreur lors du chargement du tableau de bord");
    } finally {
      setLoading(false);
    }
  }, [setKpis, setActivityFeed, setPresenceList, setLoading]);

  useEffect(() => {
    fetchDashboard();
    joinDashboard();

    return () => {
      leaveDashboard();
    };
  }, [fetchDashboard, joinDashboard, leaveDashboard]);

  return {
    kpis,
    activity: activityFeed,
    presenceMap,
    isLoading,
    refetch: fetchDashboard,
  };
}

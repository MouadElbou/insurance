import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useSocket } from "./useSocket";
import type {
  KpiData,
  ActivityItem,
  EmployeePresence,
  ChartData,
} from "@insurance/shared";
import { toast } from "sonner";

export function useDashboard() {
  const {
    kpis,
    charts,
    activityFeed,
    presenceMap,
    isLoading,
    setKpis,
    setCharts,
    setActivityFeed,
    setPresenceList,
    setLoading,
  } = useDashboardStore();
  const { joinDashboard, leaveDashboard } = useSocket();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiData, chartData, activity, presence] = await Promise.all([
        api.get<KpiData>("dashboard/kpis"),
        api.get<ChartData>("dashboard/charts"),
        api.get<ActivityItem[]>("dashboard/activity"),
        api.get<EmployeePresence[]>("dashboard/presence"),
      ]);
      setKpis(kpiData);
      setCharts(chartData);
      setActivityFeed(activity);
      setPresenceList(presence);
    } catch {
      toast.error("Erreur lors du chargement du tableau de bord");
    } finally {
      setLoading(false);
    }
  }, [setKpis, setCharts, setActivityFeed, setPresenceList, setLoading]);

  useEffect(() => {
    fetchDashboard();
    joinDashboard();

    return () => {
      leaveDashboard();
    };
  }, [fetchDashboard, joinDashboard, leaveDashboard]);

  return {
    kpis,
    charts,
    activity: activityFeed,
    presenceMap,
    isLoading,
    refetch: fetchDashboard,
  };
}

import { create } from "zustand";
import type {
  KpiData,
  ActivityItem,
  EmployeePresence,
  PresenceUpdatePayload,
} from "@insurance/shared";

interface DashboardState {
  kpis: KpiData | null;
  activityFeed: ActivityItem[];
  presenceMap: Map<string, EmployeePresence>;
  isLoading: boolean;
  setKpis: (kpis: KpiData) => void;
  addActivity: (item: ActivityItem) => void;
  setActivityFeed: (items: ActivityItem[]) => void;
  updatePresence: (presence: PresenceUpdatePayload) => void;
  setPresenceList: (list: EmployeePresence[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const MAX_ACTIVITY_ITEMS = 50;

export const useDashboardStore = create<DashboardState>((set) => ({
  kpis: null,
  activityFeed: [],
  presenceMap: new Map(),
  isLoading: true,

  setKpis: (kpis) => set({ kpis }),

  addActivity: (item) =>
    set((state) => ({
      activityFeed: [item, ...state.activityFeed].slice(0, MAX_ACTIVITY_ITEMS),
    })),

  setActivityFeed: (items) => set({ activityFeed: items }),

  updatePresence: (presence) =>
    set((state) => {
      const newMap = new Map(state.presenceMap);
      const existing = newMap.get(presence.employee_id);
      newMap.set(presence.employee_id, {
        employee_id: presence.employee_id,
        employee_name: existing?.employee_name ?? "",
        status: presence.status,
        last_heartbeat: presence.last_heartbeat,
      });
      return { presenceMap: newMap };
    }),

  setPresenceList: (list) =>
    set(() => {
      const newMap = new Map<string, EmployeePresence>();
      list.forEach((p) => newMap.set(p.employee_id, p));
      return { presenceMap: newMap };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () =>
    set({
      kpis: null,
      activityFeed: [],
      presenceMap: new Map(),
      isLoading: true,
    }),
}));

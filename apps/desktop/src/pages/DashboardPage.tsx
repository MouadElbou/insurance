import { useDashboard } from "@/hooks/useDashboard";
import { KpiCardGrid } from "@/components/dashboard/KpiCardGrid";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PresencePanel } from "@/components/dashboard/PresencePanel";
import { RevenueTrendChart } from "@/components/dashboard/charts/RevenueTrendChart";
import { TypeBreakdownChart } from "@/components/dashboard/charts/TypeBreakdownChart";
import { SourceBreakdownChart } from "@/components/dashboard/charts/SourceBreakdownChart";
import { TopEmployeesChart } from "@/components/dashboard/charts/TopEmployeesChart";
import { DailyVolumeChart } from "@/components/dashboard/charts/DailyVolumeChart";
import { useState } from "react";

type Period = "today" | "week" | "month";

const periodLabels: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
};

export function DashboardPage() {
  const { kpis, charts, activity, presenceMap, isLoading } = useDashboard();
  const [period, setPeriod] = useState<Period>("month");

  return (
    <div className="px-8 pt-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Page Title & Filters */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
            Tableau de bord
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Analyse des performances du cabinet
          </p>
        </div>
        <div className="bg-surface-container-low p-1 rounded-xl flex gap-1">
          {(Object.keys(periodLabels) as Period[]).map((key) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                period === key
                  ? "text-primary bg-surface-container-lowest shadow-sm rounded-lg"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {periodLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCardGrid kpis={kpis} isLoading={isLoading} period={period} />

      {/* Charts Row 1: Revenue trend (2/3) + Top employees (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <RevenueTrendChart
            data={charts?.monthly_trend ?? []}
            isLoading={isLoading}
          />
        </div>
        <div>
          <TopEmployeesChart
            data={charts?.top_employees ?? []}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Charts Row 2: Type (1/4) + Source (1/4) + Activity (2/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <TypeBreakdownChart
          data={charts?.by_type ?? []}
          isLoading={isLoading}
        />
        <SourceBreakdownChart
          data={charts?.by_source ?? []}
          isLoading={isLoading}
        />
        <div className="lg:col-span-2">
          <ActivityFeed items={activity} isLoading={isLoading} />
        </div>
      </div>

      {/* Row 3: Daily Volume (3/4) + Presence (1/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <DailyVolumeChart
            data={charts?.daily_volume ?? []}
            isLoading={isLoading}
          />
        </div>
        <div>
          <PresencePanel presenceMap={presenceMap} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

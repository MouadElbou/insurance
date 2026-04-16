import { useDashboard } from "@/hooks/useDashboard";
import { KpiCardGrid } from "@/components/dashboard/KpiCardGrid";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PresencePanel } from "@/components/dashboard/PresencePanel";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function DashboardPage() {
  const { kpis, activity, presenceMap, isLoading, refetch } = useDashboard();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de votre activite
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={isLoading}
          className="h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <KpiCardGrid kpis={kpis} isLoading={isLoading} />

      {/* Activity + Presence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed items={activity} isLoading={isLoading} />
        </div>
        <div>
          <PresencePanel presenceMap={presenceMap} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

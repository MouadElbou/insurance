import type { KpiData } from "@insurance/shared";
import { KpiCard } from "./KpiCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Banknote,
  TrendingUp,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { useState } from "react";

interface KpiCardGridProps {
  kpis: KpiData | null;
  isLoading: boolean;
}

type Period = "today" | "week" | "month";

const periodLabels: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
};

export function KpiCardGrid({ kpis, isLoading }: KpiCardGridProps) {
  const [period, setPeriod] = useState<Period>("today");

  const data = kpis ? kpis[period] : null;

  return (
    <div className="space-y-4">
      <Tabs
        value={period}
        onValueChange={(v) => setPeriod(v as Period)}
        className="w-fit"
      >
        <TabsList className="h-8">
          {(Object.keys(periodLabels) as Period[]).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="text-xs px-3 h-7"
            >
              {periodLabels[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Prime totale"
          value={data?.total_prime ?? 0}
          icon={Banknote}
          isCurrency
          isLoading={isLoading}
          staggerIndex={0}
        />
        <KpiCard
          label="Commissions"
          value={data?.total_commission ?? 0}
          icon={TrendingUp}
          isCurrency
          isLoading={isLoading}
          staggerIndex={1}
        />
        <KpiCard
          label="Operations"
          value={data?.operations_count ?? 0}
          icon={FileText}
          isLoading={isLoading}
          staggerIndex={2}
        />
        <KpiCard
          label="Polices"
          value={data?.policies_count ?? 0}
          icon={ClipboardCheck}
          isLoading={isLoading}
          staggerIndex={3}
        />
      </div>
    </div>
  );
}

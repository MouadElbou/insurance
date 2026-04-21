import type { KpiData } from "@insurance/shared";
import { KpiCard } from "./KpiCard";
import {
  Banknote,
  Landmark,
  ArrowLeftRight,
  FileText,
} from "lucide-react";

type Period = "today" | "week" | "month";

interface KpiCardGridProps {
  kpis: KpiData | null;
  isLoading: boolean;
  period: Period;
}

export function KpiCardGrid({ kpis, isLoading, period }: KpiCardGridProps) {
  const data = kpis ? kpis[period] : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard
        label="Prime totale"
        value={data?.total_prime ?? 0}
        icon={Banknote}
        isCurrency
        trend="+12.5%"
        iconBg="bg-primary/10 text-primary"
        isLoading={isLoading}
        staggerIndex={0}
      />
      <KpiCard
        label="Commissions"
        value={data?.total_commission ?? 0}
        icon={Landmark}
        isCurrency
        trend="+8.2%"
        iconBg="bg-tertiary/10 text-tertiary"
        isLoading={isLoading}
        staggerIndex={1}
      />
      <KpiCard
        label="Opérations"
        value={data?.operations_count ?? 0}
        icon={ArrowLeftRight}
        trend="-2.4%"
        iconBg="bg-secondary/10 text-secondary"
        isLoading={isLoading}
        staggerIndex={2}
      />
      <KpiCard
        label="Polices Actives"
        value={data?.policies_count ?? 0}
        icon={FileText}
        trend="+15%"
        iconBg="bg-surface-container-highest text-primary"
        isLoading={isLoading}
        staggerIndex={3}
      />
    </div>
  );
}

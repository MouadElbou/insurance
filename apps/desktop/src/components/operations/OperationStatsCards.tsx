import type { OperationStats } from "@insurance/shared";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";

interface OperationStatsCardsProps {
  stats: OperationStats | null;
  isLoading: boolean;
}

export function OperationStatsCards({
  stats,
  isLoading,
}: OperationStatsCardsProps) {
  const cards = [
    {
      label: "Volume Mensuel",
      value: stats ? formatCurrency(stats.total_prime_net) : "-",
      trend: "+12.4% vs mois dernier",
      trendColor: "text-secondary",
      icon: TrendingUp,
    },
    {
      label: "Commissions Total",
      value: stats ? formatCurrency(stats.total_commissions) : "-",
      trend: `Validé à 98%`,
      trendColor: "text-secondary",
      icon: CheckCircle,
    },
    {
      label: "Opérations / Jour",
      value: stats ? String(stats.total_operations) : "-",
      trend: `${stats?.by_type.EMISSION ?? 0} en attente`,
      trendColor: "text-tertiary",
      icon: Clock,
    },
    {
      label: "Polices Actives",
      value: stats ? String(stats.total_policies) : "-",
      trend: `${stats?.by_source.EXCEL ?? 0} depuis Excel`,
      trendColor: "text-secondary",
      icon: FileText,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/10"
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
                {card.label}
              </p>
              <h3 className="text-2xl font-extrabold tabular-nums">
                {card.value}
              </h3>
              <div
                className={`flex items-center gap-1 mt-2 ${card.trendColor} text-xs font-bold`}
              >
                <card.icon className="h-3.5 w-3.5" />
                {card.trend}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

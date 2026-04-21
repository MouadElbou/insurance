import type { MonthlyTrendPoint } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  data: MonthlyTrendPoint[];
  isLoading: boolean;
}

export function RevenueTrendChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-4">
        <div>
          <Skeleton className="h-5 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.prime_net), 1);
  const midpoint = Math.ceil(data.length / 2);

  return (
    <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-lg font-bold text-on-surface">
            Évolution du chiffre d'affaires
          </h4>
          <p className="text-sm text-outline font-medium">
            Tendance des 6 derniers mois
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs font-semibold text-outline">Primes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-surface-container-highest" />
            <span className="text-xs font-semibold text-outline">
              Précédent
            </span>
          </div>
        </div>
      </div>
      <div className="relative h-[280px] w-full flex items-end justify-between gap-1 pb-6">
        {data.map((point, i) => {
          const heightPct = Math.max((point.prime_net / maxValue) * 100, 5);
          const isPrevious = i < midpoint;
          const formatted =
            point.prime_net >= 1000000
              ? `${(point.prime_net / 1000000).toFixed(1)}M`
              : `${(point.prime_net / 1000).toFixed(0)}k`;
          return (
            <div
              key={point.label}
              className={`flex-1 rounded-t-lg relative group transition-all cursor-pointer ${
                isPrevious
                  ? "bg-surface-container-low hover:bg-primary-fixed"
                  : "bg-primary hover:bg-primary-container"
              }`}
              style={{ height: `${heightPct}%` }}
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {formatted}
              </div>
            </div>
          );
        })}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-[10px] font-bold text-outline uppercase tracking-widest">
          {data.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

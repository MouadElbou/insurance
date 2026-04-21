import type { TypeBreakdown } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  data: TypeBreakdown[];
  isLoading: boolean;
}

function formatAmount(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M MAD`;
  if (v >= 1000) return `${Math.round(v / 1000)}k MAD`;
  return `${v} MAD`;
}

export function TypeBreakdownChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex justify-center py-6">
          <Skeleton className="h-32 w-32 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.prime_net, 0) || 1;
  const production = data.find((d) => d.type === "PRODUCTION");
  const emission = data.find((d) => d.type === "EMISSION");
  const productionPct = Math.round(
    ((production?.prime_net ?? 0) / total) * 100,
  );

  // SVG circle math: circumference = 2 * PI * r
  const circumference = 2 * Math.PI * 58;
  const dashoffset = circumference * (1 - productionPct / 100);

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
      <h4 className="text-sm font-bold text-outline mb-6 uppercase tracking-widest">
        Production vs Émission
      </h4>
      <div className="flex items-center justify-center py-6">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              className="text-surface-container"
              cx="64"
              cy="64"
              r="58"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="12"
            />
            <circle
              className="text-primary"
              cx="64"
              cy="64"
              r="58"
              fill="transparent"
              stroke="currentColor"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              strokeWidth="12"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-extrabold tabular-nums">
              {productionPct}%
            </span>
            <span className="text-[8px] font-bold text-outline">
              PRODUCTION
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Production
          </span>
          <span className="font-bold">
            {formatAmount(production?.prime_net ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-surface-container" />
            Émission
          </span>
          <span className="font-bold">
            {formatAmount(emission?.prime_net ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

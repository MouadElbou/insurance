import type { DailyVolumePoint } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  data: DailyVolumePoint[];
  isLoading: boolean;
}

export function DailyVolumeChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const avgCount =
    data.length > 0
      ? Math.round(data.reduce((sum, d) => sum + d.count, 0) / data.length)
      : 0;

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-sm font-bold text-outline uppercase tracking-widest">
          Volume quotidien (30j)
        </h4>
        <span className="text-xs font-bold text-primary">
          Moyenne: {avgCount} opérations/jour
        </span>
      </div>
      <div className="flex items-end gap-[2px] h-32">
        {data.map((point) => {
          const heightPct = Math.max((point.count / maxCount) * 100, 3);
          return (
            <div
              key={point.date}
              className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm"
              style={{ height: `${heightPct}%` }}
              title={`${point.date}: ${point.count}`}
            />
          );
        })}
      </div>
    </div>
  );
}

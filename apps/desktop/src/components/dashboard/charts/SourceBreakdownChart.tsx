import type { SourceBreakdown } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  data: SourceBreakdown[];
  isLoading: boolean;
}

const SOURCE_ORDER = ["EXCEL", "MANUAL", "SCRAPER"];
const SOURCE_LABELS: Record<string, string> = {
  EXCEL: "Excel",
  MANUAL: "Manuel",
  SCRAPER: "Scraper",
};
const SOURCE_OPACITY: Record<string, string> = {
  EXCEL: "bg-primary/80",
  MANUAL: "bg-primary/60",
  SCRAPER: "bg-primary/40",
};

export function SourceBreakdownChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-end gap-2 h-24">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-full rounded-t" />
          ))}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  const sorted = SOURCE_ORDER.map(
    (key) =>
      data.find((d) => d.source === key) ?? {
        source: key,
        count: 0,
        prime_net: 0,
      },
  );

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
      <h4 className="text-sm font-bold text-outline mb-6 uppercase tracking-widest">
        Sources des données
      </h4>
      <div className="space-y-6">
        <div className="flex items-end gap-2 h-24">
          {sorted.map((item) => {
            const heightPct = Math.max((item.count / maxCount) * 100, 5);
            const pct = Math.round((item.count / total) * 100);
            return (
              <div
                key={item.source}
                className={`flex-1 ${SOURCE_OPACITY[item.source] ?? "bg-primary/40"} rounded-t group relative transition-all`}
                style={{ height: `${heightPct}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 text-[9px] font-extrabold text-outline uppercase text-center">
          {sorted.map((item) => (
            <span key={item.source}>
              {SOURCE_LABELS[item.source] ?? item.source}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

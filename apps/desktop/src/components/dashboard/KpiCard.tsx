import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  isCurrency?: boolean;
  trend?: string;
  iconBg?: string;
  className?: string;
  staggerIndex?: number;
  isLoading?: boolean;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  isCurrency = false,
  trend,
  iconBg = "bg-primary/10 text-primary",
  className,
  staggerIndex = 0,
  isLoading = false,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-surface-container-lowest rounded-xl p-6 space-y-4",
          className,
        )}
      >
        <div className="flex justify-between items-start">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-7 w-32" />
        </div>
      </div>
    );
  }

  const displayValue = isCurrency ? formatCurrency(value) : String(value);
  const delayClass = `stagger-${staggerIndex + 1}`;
  const isNegative = trend?.startsWith("-");

  return (
    <div
      className={cn(
        "bg-surface-container-lowest rounded-xl p-6 space-y-4 transition-all duration-300",
        "hover:-translate-y-0.5",
        "animate-slide-up opacity-0",
        delayClass,
        className,
      )}
      style={{ animationFillMode: "forwards" }}
    >
      <div className="flex justify-between items-start">
        <div className={cn("p-2 rounded-lg", iconBg)}>
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        {trend && (
          <span
            className={cn(
              "text-xs font-bold px-2 py-1 rounded-full",
              isNegative
                ? "text-error bg-error-container/20"
                : "text-secondary bg-secondary-container/20",
            )}
          >
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-outline uppercase tracking-wider">
          {label}
        </p>
        <h3
          className={cn(
            "text-2xl font-extrabold text-on-surface",
            isCurrency && "tabular-nums",
          )}
        >
          {displayValue}
        </h3>
      </div>
    </div>
  );
}

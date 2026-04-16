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
  className,
  staggerIndex = 0,
  isLoading = false,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card p-5 space-y-3",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-7 w-32" />
        {trend !== undefined && <Skeleton className="h-3 w-20" />}
      </div>
    );
  }

  const displayValue = isCurrency ? formatCurrency(value) : String(value);
  const delayClass = `stagger-${staggerIndex + 1}`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 transition-all duration-300",
        "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
        "animate-slide-up opacity-0",
        delayClass,
        className,
      )}
      style={{ animationFillMode: "forwards" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8">
          <Icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <p
        className={cn(
          "text-2xl font-bold tracking-tight",
          isCurrency && "font-mono tabular-nums",
        )}
      >
        {displayValue}
      </p>
      {trend && (
        <p className="text-xs text-muted-foreground mt-1.5">{trend}</p>
      )}
    </div>
  );
}

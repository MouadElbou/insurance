import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface CurrencyDisplayProps {
  value: string | number | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg font-semibold",
};

export function CurrencyDisplay({
  value,
  className,
  size = "md",
}: CurrencyDisplayProps) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight",
        sizeStyles[size],
        className,
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}

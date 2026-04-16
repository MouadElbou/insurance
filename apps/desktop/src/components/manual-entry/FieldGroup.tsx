import { cn } from "@/lib/utils";

interface FieldGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldGroup({
  title,
  description,
  children,
  className,
}: FieldGroupProps) {
  return (
    <div className={cn("rounded-xl border p-4 space-y-4", className)}>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

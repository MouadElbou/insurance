import type { UploadResult } from "@insurance/shared";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, X } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

interface UploadResultSummaryProps {
  result: UploadResult | null;
  onDismiss: () => void;
}

export function UploadResultSummary({
  result,
  onDismiss,
}: UploadResultSummaryProps) {
  if (!result) return null;

  const isSuccess = result.status === "COMPLETED";
  const isFailed = result.status === "FAILED";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 animate-slide-up",
        isSuccess && "border-green-200 bg-green-50/50",
        isFailed && "border-red-200 bg-red-50/50",
        !isSuccess && !isFailed && "border-amber-200 bg-amber-50/50",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {isSuccess ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-semibold",
                isSuccess && "text-green-800",
                isFailed && "text-red-800",
                !isSuccess && !isFailed && "text-amber-800",
              )}
            >
              {isSuccess
                ? "Import termine avec succes"
                : isFailed
                  ? "Echec de l'import"
                  : "Import partiellement reussi"}
            </p>
            <StatusBadge status={result.status} />
          </div>

          {result.error_message && (
            <p className="text-xs text-red-700 bg-red-100/60 rounded-md px-2 py-1.5">
              {result.error_message}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span className="text-muted-foreground">Total :</span>
              <span className="font-medium tabular-nums">
                {result.total_rows}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Crees :</span>
              <span className="font-medium tabular-nums text-green-700">
                {result.created_count}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Mis a jour :</span>
              <span className="font-medium tabular-nums text-blue-700">
                {result.updated_count}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Ignores :</span>
              <span className="font-medium tabular-nums text-amber-700">
                {result.skipped_count}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onDismiss}
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

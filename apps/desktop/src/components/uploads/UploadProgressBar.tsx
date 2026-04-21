import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface UploadProgressBarProps {
  progress: {
    upload_id: string;
    processed_rows: number;
    total_rows: number;
  } | null;
  isUploading: boolean;
}

export function UploadProgressBar({
  progress,
  isUploading,
}: UploadProgressBarProps) {
  if (!isUploading) return null;

  const hasProgress = progress !== null && progress.total_rows > 0;
  const percentage = hasProgress
    ? Math.round((progress.processed_rows / progress.total_rows) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 space-y-3 animate-slide-up">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface">
            {hasProgress
              ? "Traitement en cours..."
              : "Envoi du fichier..."}
          </p>
          {hasProgress && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              {progress.processed_rows} / {progress.total_rows} lignes traitees
            </p>
          )}
        </div>
        {hasProgress && (
          <span className="text-sm font-mono font-medium tabular-nums text-primary">
            {percentage}%
          </span>
        )}
      </div>

      <Progress value={hasProgress ? percentage : null} />
    </div>
  );
}

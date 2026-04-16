import { useUploads } from "@/hooks/useUploads";
import { UploadDropzone } from "@/components/uploads/UploadDropzone";
import { UploadProgressBar } from "@/components/uploads/UploadProgressBar";
import { UploadResultSummary } from "@/components/uploads/UploadResultSummary";
import { UploadHistoryTable } from "@/components/uploads/UploadHistoryTable";
import { Upload } from "lucide-react";

export function UploadsPage() {
  const {
    uploads,
    pagination,
    currentProgress,
    lastResult,
    isUploading,
    isLoading,
    uploadFile,
    clearResult,
  } = useUploads();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Imports Excel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Importez vos fichiers Excel pour traiter les operations
          </p>
        </div>
      </div>

      {/* Upload dropzone */}
      <UploadDropzone onUpload={uploadFile} isUploading={isUploading} />

      {/* Upload progress */}
      {isUploading && (
        <div className="animate-slide-up">
          <UploadProgressBar
            isUploading={isUploading}
            progress={currentProgress}
          />
        </div>
      )}

      {/* Upload result */}
      {lastResult && (
        <div className="animate-slide-up">
          <UploadResultSummary result={lastResult} onDismiss={clearResult} />
        </div>
      )}

      {/* Upload history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Historique des imports</h2>
        <UploadHistoryTable uploads={uploads} isLoading={isLoading} />
      </div>
    </div>
  );
}

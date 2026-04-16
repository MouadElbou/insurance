import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";

interface UploadDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ACCEPTED_EXTENSIONS = [".xlsx"];

export function UploadDropzone({ onUpload, isUploading }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (
      !ACCEPTED_TYPES.includes(file.type) &&
      !ACCEPTED_EXTENSIONS.includes(ext)
    ) {
      return "Format non supporte. Utilisez un fichier .xlsx";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
    },
    [validateFile],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || isUploading) return;
    setError(null);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
    } catch {
      // Error handled by parent
    }
  }, [selectedFile, isUploading, onUpload]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isUploading) setIsDragOver(true);
    },
    [isUploading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [isUploading, handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer",
          "flex flex-col items-center justify-center text-center min-h-[200px]",
          isDragOver && "border-primary bg-primary/5 scale-[1.01]",
          !isDragOver &&
            !isUploading &&
            "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/40",
          isUploading && "opacity-60 cursor-not-allowed border-muted",
          error && "border-destructive/50",
        )}
        role="button"
        tabIndex={0}
        aria-label="Zone de depot de fichier"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isUploading) inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
          aria-hidden
        />

        <div
          className={cn(
            "rounded-xl p-4 mb-4 transition-colors",
            isDragOver ? "bg-primary/10" : "bg-muted/60",
          )}
        >
          {selectedFile && !error ? (
            <FileSpreadsheet
              className="h-8 w-8 text-primary"
              strokeWidth={1.5}
            />
          ) : (
            <Upload
              className={cn(
                "h-8 w-8 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground/60",
              )}
              strokeWidth={1.5}
            />
          )}
        </div>

        {selectedFile && !error ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {isDragOver
                ? "Deposez le fichier ici"
                : "Glissez un fichier Excel ici"}
            </p>
            <p className="text-xs text-muted-foreground">
              ou cliquez pour parcourir
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              Format accepte : .xlsx
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-destructive text-sm animate-slide-up">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {selectedFile && !error && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Envoyer le fichier
            </>
          )}
        </Button>
      )}
    </div>
  );
}

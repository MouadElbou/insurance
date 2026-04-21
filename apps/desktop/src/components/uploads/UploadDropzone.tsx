import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  CloudUpload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Download,
  ShieldCheck,
  Zap,
} from "lucide-react";
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
      return "Format non supporté. Utilisez un fichier .xlsx";
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
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-sm relative overflow-hidden group">
      {/* Gradient top bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary" />

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        onChange={handleInputChange}
        className="hidden"
        disabled={isUploading}
        aria-hidden
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && !selectedFile && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-all",
          isDragOver
            ? "border-primary/60 bg-primary-fixed/30"
            : "border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container-low",
          isUploading && "opacity-60 cursor-not-allowed",
          !isUploading && !selectedFile && "cursor-pointer",
          error && "border-error/40",
        )}
        role="button"
        tabIndex={0}
        aria-label="Zone de dépot de fichier"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isUploading) inputRef.current?.click();
          }
        }}
      >
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
            selectedFile && !error
              ? "bg-secondary-container/30"
              : "bg-primary-fixed",
          )}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : selectedFile && !error ? (
            <FileSpreadsheet className="h-8 w-8 text-secondary" />
          ) : (
            <CloudUpload className="h-8 w-8 text-primary" />
          )}
        </div>

        {selectedFile && !error ? (
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-on-surface">
              {selectedFile.name}
            </h3>
            <p className="text-on-surface-variant text-sm">
              {formatFileSize(selectedFile.size)}
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                disabled={isUploading}
                className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUploading ? "Envoi en cours..." : "Lancer l'import"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setError(null);
                }}
                className="bg-surface-container-highest text-on-surface px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-surface-container transition-colors"
              >
                Changer de fichier
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-on-surface mb-2">
              {isDragOver
                ? "Déposez le fichier ici"
                : "Glissez-déposez votre fichier .xlsx"}
            </h3>
            <p className="text-on-surface-variant text-sm mb-6 max-w-sm">
              Ou parcourez vos fichiers locaux. Assurez-vous que votre fichier
              respecte le format standard d'AssurTrack.
            </p>
            <div className="flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                disabled={isUploading}
                className="bg-surface-container-highest text-primary px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-surface-container transition-colors"
              >
                Parcourir les fichiers
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-outline-variant/30 text-on-surface px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Modèle .xlsx
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 text-error text-sm animate-slide-up mt-4">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Feature cards */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="p-4 bg-surface-container-low rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-on-surface">
              Validation Automatique
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Vérification instantanée des colonnes et des formats de données
            monétaires.
          </p>
        </div>
        <div className="p-4 bg-surface-container-low rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-on-surface">
              Traitement Rapide
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Jusqu'à 10 000 lignes traitées en moins de 30 secondes.
          </p>
        </div>
      </div>
    </div>
  );
}

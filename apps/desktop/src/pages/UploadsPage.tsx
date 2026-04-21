import { useUploads } from "@/hooks/useUploads";
import { UploadDropzone } from "@/components/uploads/UploadDropzone";
import { UploadProgressBar } from "@/components/uploads/UploadProgressBar";
import { UploadResultSummary } from "@/components/uploads/UploadResultSummary";
import { UploadHistoryTable } from "@/components/uploads/UploadHistoryTable";
import {
  ChevronRight,
  CloudUpload,
  Timer,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Téléchargement", num: 1 },
  { label: "Mapping", num: 2 },
  { label: "Aperçu", num: 3 },
  { label: "Historique", num: 4 },
];

export function UploadsPage() {
  const {
    uploads,
    currentProgress,
    lastResult,
    isUploading,
    isLoading,
    uploadFile,
    clearResult,
  } = useUploads();

  const activeStep = 1;
  const hasFile = false; // Will be managed by dropzone

  return (
    <div className="p-10 max-w-7xl mx-auto animate-fade-in pb-24">
      {/* Breadcrumbs & Title */}
      <div className="mb-10">
        <nav className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-outline mb-2">
          <span>Architecture</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-primary">Imports Excel</span>
        </nav>
        <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface">
          Importer des données
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          Intégrez vos fichiers de polices et contrats directement dans le
          système avec notre outil d'import intelligent.
        </p>
      </div>

      {/* Multi-step Flow Indicator */}
      <div className="mb-12">
        <div className="flex items-center justify-between relative max-w-4xl mx-auto">
          {/* Progress Line background */}
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-surface-container-highest -translate-y-1/2 z-0" />
          {/* Progress Line active */}
          <div
            className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 z-0 transition-all duration-500"
            style={{ width: `${((activeStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
          {STEPS.map((step) => (
            <div key={step.num} className="relative z-10 flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-background transition-all",
                  step.num <= activeStep
                    ? "bg-primary text-white shadow-lg"
                    : "bg-surface-container-high text-on-surface-variant",
                )}
              >
                {step.num}
              </div>
              <span
                className={cn(
                  "mt-3 text-xs tracking-tight",
                  step.num <= activeStep
                    ? "font-bold text-primary"
                    : "font-semibold text-outline",
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Asymmetric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Upload Area (2/3) */}
        <div className="lg:col-span-2">
          <UploadDropzone onUpload={uploadFile} isUploading={isUploading} />

          {/* Progress overlay */}
          {isUploading && currentProgress && (
            <div className="mt-6 animate-slide-up">
              <UploadProgressBar
                isUploading={isUploading}
                progress={currentProgress}
              />
            </div>
          )}

          {/* Result overlay */}
          {lastResult && (
            <div className="mt-6 animate-slide-up">
              <UploadResultSummary result={lastResult} onDismiss={clearResult} />
            </div>
          )}
        </div>

        {/* Guidance / Info Card (1/3) */}
        <div className="space-y-6">
          <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden">
            <h4 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Conseils d'import
            </h4>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-[10px] font-bold">i</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Les dates doivent être au format{" "}
                  <strong className="text-on-surface">DD/MM/YYYY</strong>.
                </p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-[10px] font-bold">i</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Le séparateur de décimales doit être la{" "}
                  <strong className="text-on-surface">virgule (,)</strong>.
                </p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-[10px] font-bold">i</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Évitez les cellules fusionnées dans l'en-tête de votre
                  fichier.
                </p>
              </li>
            </ul>
          </div>

          {/* Dark stats card */}
          <div className="bg-inverse-surface p-6 rounded-xl text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                Statistiques Globales
              </span>
              <ArrowRight className="h-4 w-4 opacity-60" />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] opacity-70 mb-1">
                  TOTAL IMPORTÉ (CE MOIS)
                </p>
                <p className="text-2xl font-bold tabular-nums tracking-tighter">
                  {uploads.length > 0
                    ? `${uploads.reduce((sum, u) => sum + u.total_rows, 0).toLocaleString("fr-FR")} lignes`
                    : "0 lignes"}
                </p>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary-fixed rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, uploads.length > 0 ? 75 : 0)}%`,
                  }}
                />
              </div>
              <p className="text-xs opacity-70">
                {uploads.filter((u) => u.status === "COMPLETED").length} imports
                réussis ce mois
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Import History Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-on-surface">
            Historique des imports récents
          </h3>
          <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
            Tout voir
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <UploadHistoryTable uploads={uploads} isLoading={isLoading} />
      </div>

      {/* Sticky Progress Summary Footer */}
      <div className="fixed bottom-0 right-0 left-64 glass border-t border-outline-variant/20 px-10 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary-fixed border-2 border-white flex items-center justify-center">
              <Timer className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary-fixed border-2 border-white flex items-center justify-center">
              <CheckCheck className="h-3.5 w-3.5 text-on-secondary-container" />
            </div>
          </div>
          <p className="text-sm font-medium text-on-surface-variant">
            {isUploading
              ? "Import en cours..."
              : "Prêt pour l'importation. Aucun fichier sélectionné."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant text-sm font-bold px-6 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            Annuler
          </button>
          <button
            className={cn(
              "bg-primary text-white text-sm font-bold px-8 py-2.5 rounded-lg shadow-md transition-all",
              !isUploading && "opacity-50 cursor-not-allowed",
            )}
            disabled={!isUploading}
          >
            Suivant : Mapping
          </button>
        </div>
      </div>
    </div>
  );
}

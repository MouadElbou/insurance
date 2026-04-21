import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { rawClient } from "@/lib/api";
import { useOperationsStore } from "@/stores/operations.store";
import { toast } from "sonner";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const filters = useOperationsStore((s) => s.filters);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const searchParams: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          key !== "page" &&
          key !== "per_page"
        ) {
          searchParams[key] = String(value);
        }
      });
      searchParams["format"] = "csv";

      const response = await rawClient.get("operations/export", {
        searchParams,
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "operations-export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export terminé");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-4 py-2 bg-surface-container-lowest text-on-surface text-sm font-medium rounded-xl border border-outline-variant/15 hover:bg-surface-container transition-all flex items-center gap-2 disabled:opacity-50"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Exporter (CSV)
    </button>
  );
}

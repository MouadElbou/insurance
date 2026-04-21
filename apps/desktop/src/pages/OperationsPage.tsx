import { useOperations } from "@/hooks/useOperations";
import { useOperationStats } from "@/hooks/useOperationStats";
import { OperationStatsCards } from "@/components/operations/OperationStatsCards";
import { OperationsFilters } from "@/components/operations/OperationsFilters";
import { OperationsTable } from "@/components/operations/OperationsTable";
import { OperationDetailPanel } from "@/components/operations/OperationDetailPanel";
import { ExportButton } from "@/components/operations/ExportButton";
import { useOperationsStore } from "@/stores/operations.store";
import { Download, PlusCircle } from "lucide-react";

export function OperationsPage() {
  const {
    operations,
    pagination,
    selectedOperation,
    isLoading,
    selectOperation,
  } = useOperations();
  const { stats, isLoading: statsLoading } = useOperationStats();

  const setFilters = useOperationsStore((s) => s.setFilters);

  const handlePageChange = (page: number) => {
    setFilters({ page });
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
            Registre des Opérations
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Gérez et suivez l'ensemble de votre production d'assurance.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton />
          <button className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Nouvelle Opération
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <OperationStatsCards stats={stats} isLoading={statsLoading} />

      {/* Filter Bar */}
      <OperationsFilters />

      {/* Table */}
      <OperationsTable
        operations={operations}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onRowClick={(op) => selectOperation(op)}
      />

      {/* Footer Meta Info */}
      <div className="flex items-center justify-between pt-4 opacity-60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Connecté au Web-Scraper (Live)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-outline" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Dernier Import: Aujourd&apos;hui, 09:42
            </span>
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest">
          Version v2.4.1 Build 20231015
        </div>
      </div>

      {/* Detail panel */}
      <OperationDetailPanel
        operation={selectedOperation}
        open={!!selectedOperation}
        onOpenChange={(open) => {
          if (!open) selectOperation(null);
        }}
      />
    </div>
  );
}

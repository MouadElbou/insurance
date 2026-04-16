import { useOperations } from "@/hooks/useOperations";
import { useEmployees } from "@/hooks/useEmployees";
import { OperationsFilters } from "@/components/operations/OperationsFilters";
import { OperationsTable } from "@/components/operations/OperationsTable";
import { OperationDetailPanel } from "@/components/operations/OperationDetailPanel";
import { ExportButton } from "@/components/operations/ExportButton";
import { useOperationsStore } from "@/stores/operations.store";
import { FileText } from "lucide-react";

export function OperationsPage() {
  const {
    operations,
    pagination,
    selectedOperation,
    isLoading,
    selectOperation,
  } = useOperations();
  // Load employees for filter dropdown
  useEmployees();

  const setFilters = useOperationsStore((s) => s.setFilters);

  const handlePageChange = (page: number) => {
    setFilters({ page });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pagination.total_items > 0 ? (
                <>
                  <span className="tabular-nums font-medium text-foreground">
                    {pagination.total_items}
                  </span>{" "}
                  operation{pagination.total_items !== 1 ? "s" : ""} au total
                </>
              ) : (
                "Gerez vos operations de courtage"
              )}
            </p>
          </div>
        </div>
        <ExportButton />
      </div>

      {/* Filters */}
      <OperationsFilters />

      {/* Table */}
      <OperationsTable
        operations={operations}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onRowClick={(op) => selectOperation(op)}
      />

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

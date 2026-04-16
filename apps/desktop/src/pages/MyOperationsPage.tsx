import { useOperations } from "@/hooks/useOperations";
import { OperationsFilters } from "@/components/operations/OperationsFilters";
import { OperationsTable } from "@/components/operations/OperationsTable";
import { OperationDetailPanel } from "@/components/operations/OperationDetailPanel";
import { useOperationsStore } from "@/stores/operations.store";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

export function MyOperationsPage() {
  const {
    operations,
    pagination,
    selectedOperation,
    isLoading,
    selectOperation,
  } = useOperations();

  const setFilters = useOperationsStore((s) => s.setFilters);

  const handlePageChange = (page: number) => {
    setFilters({ page });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Mes operations
            {!isLoading && pagination.total_items > 0 && (
              <Badge variant="secondary" className="text-xs font-medium">
                {pagination.total_items}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Consultez et suivez vos operations d'assurance
          </p>
        </div>
      </div>

      {/* Filters (no employee dropdown -- backend filters by logged-in user) */}
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

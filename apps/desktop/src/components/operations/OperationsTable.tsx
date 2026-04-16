import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Operation } from "@insurance/shared";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/format";

interface OperationsTableProps {
  operations: Operation[];
  isLoading: boolean;
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  onPageChange: (page: number) => void;
  onRowClick: (operation: Operation) => void;
}

export function OperationsTable({
  operations,
  isLoading,
  pagination,
  onPageChange,
  onRowClick,
}: OperationsTableProps) {
  const columns = useMemo<ColumnDef<Operation, any>[]>(
    () => [
      {
        accessorKey: "policy_number",
        header: "N. Police",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: ({ getValue }) => (
          <span className="truncate max-w-[180px] block">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => (
          <StatusBadge status={getValue() as "PRODUCTION" | "EMISSION"} />
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ getValue }) => (
          <StatusBadge status={getValue() as "EXCEL" | "MANUAL" | "SCRAPER"} />
        ),
      },
      {
        accessorKey: "prime_net",
        header: "Prime nette",
        cell: ({ getValue }) => (
          <CurrencyDisplay value={getValue() as string | null} size="sm" />
        ),
      },
      {
        accessorKey: "commission",
        header: "Commission",
        cell: ({ getValue }) => (
          <CurrencyDisplay value={getValue() as string | null} size="sm" />
        ),
      },
      {
        accessorKey: "effective_date",
        header: "Date effet",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(getValue() as string | null)}
          </span>
        ),
      },
      {
        accessorKey: "employee_name",
        header: "Employe",
        cell: ({ getValue }) => (
          <span className="text-sm truncate max-w-[140px] block">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: operations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination.total_pages,
  });

  return (
    <DataTable
      table={table}
      columns={columns}
      isLoading={isLoading}
      onRowClick={onRowClick}
      emptyMessage="Aucune operation trouvee"
      pagination={{
        page: pagination.page,
        totalPages: pagination.total_pages,
        totalItems: pagination.total_items,
        onPageChange,
      }}
    />
  );
}

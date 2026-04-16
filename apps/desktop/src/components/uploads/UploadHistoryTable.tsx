import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Upload } from "@insurance/shared";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime, formatFileSize } from "@/lib/format";

interface UploadHistoryTableProps {
  uploads: Upload[];
  isLoading: boolean;
}

export function UploadHistoryTable({
  uploads,
  isLoading,
}: UploadHistoryTableProps) {
  const columns = useMemo<ColumnDef<Upload, any>[]>(
    () => [
      {
        accessorKey: "filename",
        header: "Fichier",
        cell: ({ getValue }) => (
          <span className="text-sm font-medium truncate max-w-[200px] block">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "file_size",
        header: "Taille",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground font-mono">
            {formatFileSize(getValue() as number)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ getValue }) => (
          <StatusBadge
            status={
              getValue() as
                | "PENDING"
                | "PROCESSING"
                | "COMPLETED"
                | "FAILED"
            }
          />
        ),
      },
      {
        accessorKey: "total_rows",
        header: "Lignes",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        id: "created_count",
        header: "Crees",
        accessorKey: "created_count",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums text-green-700">
            {getValue() as number}
          </span>
        ),
      },
      {
        id: "updated_count",
        header: "Mis a jour",
        accessorKey: "updated_count",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums text-blue-700">
            {getValue() as number}
          </span>
        ),
      },
      {
        id: "skipped_count",
        header: "Ignores",
        accessorKey: "skipped_count",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums text-amber-700">
            {getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: "uploaded_by_name",
        header: "Par",
        cell: ({ getValue }) => (
          <span className="text-sm truncate max-w-[120px] block">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(getValue() as string)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: uploads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      table={table}
      columns={columns}
      isLoading={isLoading}
      emptyMessage="Aucun import effectue"
    />
  );
}

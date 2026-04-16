import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type {
  Employee,
  Operation,
  OperationStats,
  PaginatedResponse,
} from "@insurance/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ArrowLeft,
  Mail,
  Hash,
  Calendar,
  FileText,
  Banknote,
  TrendingUp,
  Shield,
} from "lucide-react";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

interface EmployeeDetail {
  employee: Employee | null;
  stats: OperationStats | null;
  operations: Operation[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  isLoading: boolean;
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<EmployeeDetail>({
    employee: null,
    stats: null,
    operations: [],
    pagination: { page: 1, per_page: 25, total_items: 0, total_pages: 0 },
    isLoading: true,
  });
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (currentPage: number) => {
      if (!id) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setData((prev) => ({ ...prev, isLoading: true }));

      try {
        const [employee, stats, operations] = await Promise.all([
          api.get<Employee>(`employees/${id}`, {
            signal: abortRef.current!.signal,
          }),
          api.get<OperationStats>(`employees/${id}/stats`, {
            signal: abortRef.current!.signal,
          }),
          api.get<PaginatedResponse<Operation>>(
            `operations?employee_id=${id}&page=${currentPage}&per_page=25&sort_by=created_at&sort_order=desc`,
            { signal: abortRef.current!.signal },
          ),
        ]);

        setData({
          employee,
          stats,
          operations: operations.items,
          pagination: operations.pagination,
          isLoading: false,
        });
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          toast.error("Erreur lors du chargement du profil");
          setData((prev) => ({ ...prev, isLoading: false }));
        }
      }
    },
    [id],
  );

  useEffect(() => {
    fetchData(page);
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData, page]);

  const columns = useMemo<ColumnDef<Operation, any>[]>(
    () => [
      {
        accessorKey: "policy_number",
        header: "N. Police",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: ({ getValue }) => (
          <span className="truncate max-w-[160px] block text-sm">
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
          <StatusBadge
            status={getValue() as "EXCEL" | "MANUAL" | "SCRAPER"}
          />
        ),
      },
      {
        accessorKey: "total_prime",
        header: "Prime",
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
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(getValue() as string)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data.operations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data.pagination.total_pages,
  });

  const { employee, stats, isLoading } = data;

  if (isLoading && !employee) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!employee && !isLoading) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileText}
          title="Employe introuvable"
          description="L'employe demande n'existe pas ou a ete supprime."
          action={{
            label: "Retour aux employes",
            onClick: () => navigate("/employees"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/employees")}
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {employee?.full_name}
            </h1>
            <Badge
              variant={employee?.is_active ? "default" : "secondary"}
              className="shrink-0"
            >
              {employee?.is_active ? "Actif" : "Inactif"}
            </Badge>
            <Badge variant="outline" className="shrink-0">
              <Shield className="h-3 w-3 mr-1" />
              {employee?.role === "MANAGER" ? "Responsable" : "Employe"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {employee?.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              <span className="font-mono">{employee?.operator_code}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Depuis {formatDate(employee?.created_at ?? null)}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4 animate-slide-up stagger-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Operations</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {stats.total_operations}
            </p>
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span>{stats.by_type.PRODUCTION} prod.</span>
              <span>/</span>
              <span>{stats.by_type.EMISSION} emis.</span>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 animate-slide-up stagger-2">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Prime nette
              </span>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums">
              {formatCurrency(stats.total_prime_net)}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 animate-slide-up stagger-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Commissions
              </span>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-primary">
              {formatCurrency(stats.total_commissions)}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 animate-slide-up stagger-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Polices</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {stats.total_policies}
            </p>
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span>{stats.by_source.EXCEL} Excel</span>
              <span>/</span>
              <span>{stats.by_source.MANUAL} manuel</span>
            </div>
          </div>
        </div>
      )}

      {/* Operations table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Operations recentes</h2>
        <DataTable
          table={table}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="Aucune operation pour cet employe"
          pagination={
            data.pagination.total_pages > 0
              ? {
                  page: data.pagination.page,
                  totalPages: data.pagination.total_pages,
                  totalItems: data.pagination.total_items,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

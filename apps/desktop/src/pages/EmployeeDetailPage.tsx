import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type {
  Employee,
  Operation,
  OperationStats,
  PaginatedResponse,
} from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";
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
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-primary-fixed text-primary",
  "bg-tertiary-fixed text-tertiary",
  "bg-secondary-fixed text-secondary",
] as const;

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
          <span className="text-xs text-on-surface-variant whitespace-nowrap">
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
      <div className="p-10 max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-start gap-6">
            <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!employee && !isLoading) {
    return (
      <div className="p-10 max-w-7xl mx-auto">
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

  const initials = employee?.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colorClass = AVATAR_COLORS[0];

  return (
    <div className="p-10 max-w-7xl mx-auto animate-fade-in">
      {/* Breadcrumbs & Profile Header */}
      <div className="mb-10">
        <nav className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-outline mb-4">
          <span>Equipe</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <button
            onClick={() => navigate("/employees")}
            className="hover:text-primary transition-colors"
          >
            Collaborateurs
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-primary">{employee?.full_name}</span>
        </nav>

        <div className="flex items-start gap-6">
          {/* Back button */}
          <button
            onClick={() => navigate("/employees")}
            className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0 mt-1"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Avatar */}
          <div
            className={cn(
              "w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl shadow-inner shrink-0",
              colorClass,
            )}
          >
            {initials}
          </div>

          {/* Name, badges, meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface">
                {employee?.full_name}
              </h2>
              <span
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shrink-0",
                  employee?.is_active
                    ? "bg-secondary-container/30 text-on-secondary-container"
                    : "bg-error-container/30 text-error",
                )}
              >
                {employee?.is_active ? "Actif" : "Inactif"}
              </span>
              <span
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shrink-0 inline-flex items-center gap-1",
                  employee?.role === "MANAGER"
                    ? "bg-primary-fixed text-primary"
                    : "bg-surface-container-highest text-on-surface-variant",
                )}
              >
                <Shield className="h-3 w-3" />
                {employee?.role === "MANAGER" ? "Responsable" : "Employe"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-5 mt-2 text-sm text-on-surface-variant">
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
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10 animate-slide-up stagger-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-outline">
                Operations
              </span>
            </div>
            <p className="text-3xl font-extrabold tabular-nums tracking-tighter text-on-surface">
              {stats.total_operations}
            </p>
            <div className="flex gap-2 mt-2 text-xs text-on-surface-variant">
              <span>{stats.by_type.PRODUCTION} prod.</span>
              <span className="text-outline">/</span>
              <span>{stats.by_type.EMISSION} emis.</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10 animate-slide-up stagger-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center">
                <Banknote className="h-5 w-5 text-secondary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-outline">
                Prime nette
              </span>
            </div>
            <p className="text-3xl font-extrabold font-mono tabular-nums tracking-tighter text-on-surface">
              {formatCurrency(stats.total_prime_net)}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10 animate-slide-up stagger-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-tertiary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-outline">
                Commissions
              </span>
            </div>
            <p className="text-3xl font-extrabold font-mono tabular-nums tracking-tighter text-primary">
              {formatCurrency(stats.total_commissions)}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10 animate-slide-up stagger-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-outline">
                Polices
              </span>
            </div>
            <p className="text-3xl font-extrabold tabular-nums tracking-tighter text-on-surface">
              {stats.total_policies}
            </p>
            <div className="flex gap-2 mt-2 text-xs text-on-surface-variant">
              <span>{stats.by_source.EXCEL} Excel</span>
              <span className="text-outline">/</span>
              <span>{stats.by_source.MANUAL} manuel</span>
            </div>
          </div>
        </div>
      )}

      {/* Operations table */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold tracking-tight text-on-surface">
            Operations recentes
          </h3>
          <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
            Tout voir
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
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

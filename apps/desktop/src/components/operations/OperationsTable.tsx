import type { Operation } from "@insurance/shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Bot,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const SOURCE_ICON: Record<string, typeof FileSpreadsheet> = {
  EXCEL: FileSpreadsheet,
  SCRAPER: Bot,
  MANUAL: PenLine,
};

const SOURCE_LABEL: Record<string, string> = {
  EXCEL: "Excel",
  SCRAPER: "Scraper",
  MANUAL: "Manuel",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  if (total > 1) pages.push(total);

  return pages;
}

export function OperationsTable({
  operations,
  isLoading,
  pagination,
  onPageChange,
  onRowClick,
}: OperationsTableProps) {
  const { page, total_pages, total_items, per_page } = pagination;
  const from = total_items === 0 ? 0 : (page - 1) * per_page + 1;
  const to = Math.min(page * per_page, total_items);

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/10">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low/50">
            {[
              { label: "N° de Police", align: "" },
              { label: "Collaborateur", align: "" },
              { label: "Assureur", align: "" },
              { label: "Type", align: "" },
              { label: "Source", align: "" },
              { label: "Prime Nette", align: "text-right" },
              { label: "Commission", align: "text-right" },
              { label: "Date", align: "" },
              { label: "Actions", align: "text-right" },
            ].map((col) => (
              <th
                key={col.label}
                className={cn(
                  "px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline border-b border-outline-variant/10",
                  col.align,
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/5">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : operations.map((op) => {
                const SourceIcon = SOURCE_ICON[op.source] ?? FileSpreadsheet;
                return (
                  <tr
                    key={op.id}
                    className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                    onClick={() => onRowClick(op)}
                  >
                    {/* N° de Police */}
                    <td className="px-6 py-4 text-sm font-bold text-primary">
                      {op.policy_number}
                    </td>

                    {/* Collaborateur */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-fixed text-[10px] flex items-center justify-center font-bold text-on-primary-fixed shrink-0">
                          {getInitials(op.employee_name || "?")}
                        </div>
                        <span className="text-sm font-medium truncate">
                          {op.employee_name || "-"}
                        </span>
                      </div>
                    </td>

                    {/* Assureur (placeholder — no field in data model) */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium px-2 py-1 bg-surface-container rounded text-on-surface">
                        -
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4">
                      {op.type === "PRODUCTION" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
                          Production
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-container/20 text-tertiary">
                          Émission
                        </span>
                      )}
                    </td>

                    {/* Source */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <SourceIcon className="h-4 w-4" />
                        {SOURCE_LABEL[op.source] ?? op.source}
                      </div>
                    </td>

                    {/* Prime Nette */}
                    <td className="px-6 py-4 text-sm font-bold tabular-nums text-right">
                      {formatCurrency(op.prime_net)}
                    </td>

                    {/* Commission */}
                    <td className="px-6 py-4 text-sm font-bold tabular-nums text-right text-secondary">
                      {formatCurrency(op.commission)}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
                      {formatDate(op.effective_date)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div
                        className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="p-1.5 hover:bg-white rounded-lg text-outline hover:text-primary transition-all"
                          onClick={() => onRowClick(op)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 hover:bg-white rounded-lg text-outline hover:text-tertiary transition-all">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 hover:bg-white rounded-lg text-outline hover:text-error transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>

      {/* Pagination */}
      {!isLoading && total_items > 0 && (
        <div className="px-6 py-4 flex items-center justify-between bg-surface-container-low/30 border-t border-outline-variant/10">
          <p className="text-xs text-on-surface-variant font-medium italic">
            Affichage de {from} à {to} sur {total_items} opérations
          </p>
          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded-lg text-outline hover:bg-surface-container-low hover:text-primary disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {getPageNumbers(page, total_pages).map((p, idx) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-outline"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    p === page
                      ? "bg-primary text-white"
                      : "hover:bg-surface-container-low text-on-surface-variant",
                  )}
                >
                  {p}
                </button>
              ),
            )}

            <button
              className="p-2 rounded-lg text-outline hover:bg-surface-container-low hover:text-primary disabled:opacity-30"
              disabled={page >= total_pages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

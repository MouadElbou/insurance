import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileWarning,
  Inbox,
  RotateCcw,
} from "lucide-react";
import type { ScraperEventListItem } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  TRANSFORMER_VERDICT_COLORS,
  TRANSFORMER_VERDICT_LABELS,
} from "@/lib/constants";

interface ScraperEventsTableProps {
  events: ScraperEventListItem[];
  isLoading: boolean;
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  onPageChange: (page: number) => void;
  onRowClick: (id: string) => void;
  onReplay?: (id: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-secondary",
  POST: "text-primary",
  PUT: "text-tertiary",
  PATCH: "text-tertiary",
  DELETE: "text-error",
};

function statusTone(status: number | null): string {
  if (status === null) return "text-outline";
  if (status >= 500) return "text-error font-bold";
  if (status >= 400) return "text-tertiary font-bold";
  if (status >= 300) return "text-on-surface-variant font-semibold";
  if (status >= 200) return "text-secondary font-bold";
  return "text-outline";
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

function formatDurationMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function truncatePath(pathname: string, max = 48): string {
  if (pathname.length <= max) return pathname;
  return pathname.slice(0, max - 1) + "…";
}

/**
 * Paginated table of captured HTTP events. Row click opens a detail drawer.
 * Failed events expose an inline "rejouer" affordance for reprocessing.
 */
export function ScraperEventsTable({
  events,
  isLoading,
  pagination,
  onPageChange,
  onRowClick,
  onReplay,
}: ScraperEventsTableProps) {
  const { page, per_page, total_items, total_pages } = pagination;
  const from = total_items === 0 ? 0 : (page - 1) * per_page + 1;
  const to = Math.min(page * per_page, total_items);

  const columns: Array<{ label: string; align?: string }> = [
    { label: "Méthode" },
    { label: "Hôte / URL" },
    { label: "Statut", align: "text-right" },
    { label: "Durée", align: "text-right" },
    { label: "Verdict" },
    { label: "Capturé le" },
    { label: "Opérateur" },
    { label: "Actions", align: "text-right" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low/50">
              {columns.map((col) => (
                <th
                  key={col.label}
                  className={cn(
                    "whitespace-nowrap border-b border-outline-variant/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-outline",
                    col.align,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_col, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyRow />
                </td>
              </tr>
            ) : (
              events.map((ev) => {
                const methodClass =
                  METHOD_COLORS[ev.method.toUpperCase()] ?? "text-on-surface";
                const verdictLabel =
                  TRANSFORMER_VERDICT_LABELS[ev.transformer_verdict] ??
                  ev.transformer_verdict;
                const verdictColor =
                  TRANSFORMER_VERDICT_COLORS[ev.transformer_verdict] ?? "";
                const isError = ev.transformer_verdict === "ERROR";
                return (
                  <tr
                    key={ev.id}
                    className="group cursor-pointer transition-colors hover:bg-surface-container-low"
                    onClick={() => onRowClick(ev.id)}
                  >
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={cn(
                          "inline-block min-w-[3.5rem] rounded-md bg-surface-container-low/60 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wide tabular-nums",
                          methodClass,
                        )}
                      >
                        {ev.method}
                      </span>
                    </td>

                    <td className="max-w-[280px] px-4 py-3 align-middle">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-on-surface">
                          {ev.host}
                        </span>
                        <span
                          className="truncate font-mono text-[11px] text-on-surface-variant"
                          title={ev.pathname}
                        >
                          {truncatePath(ev.pathname)}
                        </span>
                      </div>
                    </td>

                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-right align-middle text-sm tabular-nums",
                        statusTone(ev.status_code),
                      )}
                    >
                      {ev.status_code ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle text-sm tabular-nums text-on-surface-variant">
                      {formatDurationMs(ev.duration_ms)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          verdictColor,
                        )}
                      >
                        {isError ? (
                          <FileWarning
                            className="mr-1 h-3 w-3"
                            aria-hidden
                          />
                        ) : null}
                        {verdictLabel}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm tabular-nums text-on-surface-variant">
                      {formatDateTime(ev.captured_at)}
                    </td>

                    <td className="max-w-[180px] px-4 py-3 align-middle">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-on-surface">
                          {ev.employee.full_name}
                        </span>
                        <span className="truncate font-mono text-[11px] text-outline">
                          {ev.employee.operator_code}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                      <div
                        className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-outline transition-all hover:bg-surface-container hover:text-primary"
                          onClick={() => onRowClick(ev.id)}
                          aria-label="Voir les détails"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {onReplay && isError ? (
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-outline transition-all hover:bg-surface-container hover:text-tertiary"
                            onClick={() => onReplay(ev.id)}
                            aria-label="Rejouer l'événement"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && total_items > 0 ? (
        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
          <p className="text-xs font-medium italic text-on-surface-variant">
            Affichage de {from} à {to} sur {total_items} événements
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-outline hover:bg-surface-container-low hover:text-primary disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {getPageNumbers(page, total_pages).map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-outline">
                  ...
                </span>
              ) : (
                <button
                  type="button"
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-bold transition-all",
                    p === page
                      ? "bg-primary text-white"
                      : "text-on-surface-variant hover:bg-surface-container-low",
                  )}
                >
                  {p}
                </button>
              ),
            )}

            <button
              type="button"
              className="rounded-lg p-2 text-outline hover:bg-surface-container-low hover:text-primary disabled:opacity-30"
              disabled={page >= total_pages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low">
        <Inbox className="h-5 w-5 text-outline" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-on-surface">
        Aucun événement capturé
      </h3>
      <p className="max-w-md text-sm text-on-surface-variant">
        Ouvrez un portail assureur pour commencer à capturer automatiquement
        les opérations. Les événements apparaîtront ici dès réception.
      </p>
    </div>
  );
}

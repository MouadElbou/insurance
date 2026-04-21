import type { Upload } from "@insurance/shared";
import { FileText } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface UploadHistoryTableProps {
  uploads: Upload[];
  isLoading: boolean;
}

function getStatusConfig(status: Upload["status"]) {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Succès",
        iconColor: "text-green-600",
        badgeBg: "bg-secondary-container",
        badgeText: "text-on-secondary-container",
        dotBg: "bg-secondary",
      };
    case "FAILED":
      return {
        label: "Échec",
        iconColor: "text-error",
        badgeBg: "bg-error-container",
        badgeText: "text-on-error-container",
        dotBg: "bg-error",
      };
    case "PROCESSING":
      return {
        label: "En cours",
        iconColor: "text-primary",
        badgeBg: "bg-primary-fixed",
        badgeText: "text-primary",
        dotBg: "bg-primary",
      };
    default:
      // PENDING or partial
      return {
        label: "Partiel",
        iconColor: "text-amber-600",
        badgeBg: "bg-tertiary-fixed",
        badgeText: "text-on-tertiary-fixed",
        dotBg: "bg-tertiary-container",
      };
  }
}

function TableSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
      <div className="bg-surface-container-low px-6 py-4 flex gap-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex gap-8 border-t border-outline-variant/10">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function UploadHistoryTable({
  uploads,
  isLoading,
}: UploadHistoryTableProps) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (uploads.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm p-12 text-center">
        <FileText className="h-12 w-12 text-outline mx-auto mb-4" />
        <p className="text-on-surface-variant font-medium">
          Aucun import effectué
        </p>
        <p className="text-outline text-sm mt-1">
          Vos imports apparaîtront ici une fois effectués.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-container-low">
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-outline">
              Date de l'import
            </th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-outline">
              Nom du fichier
            </th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-outline text-right">
              Lignes
            </th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-outline">
              Statut
            </th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-outline text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {uploads.map((upload) => {
            const config = getStatusConfig(upload.status);
            return (
              <tr
                key={upload.id}
                className="hover:bg-surface-container-low transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-on-surface whitespace-nowrap">
                  {formatDateTime(upload.created_at)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <FileText className={cn("h-5 w-5 shrink-0", config.iconColor)} />
                    <span className="text-sm font-medium text-on-surface truncate max-w-[240px]">
                      {upload.filename}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm tabular-nums text-right font-medium">
                  {upload.total_rows.toLocaleString("fr-FR")}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                      config.badgeBg,
                      config.badgeText,
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mr-1.5",
                        config.dotBg,
                      )}
                    />
                    {config.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-primary text-sm font-bold hover:underline">
                    View Log
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

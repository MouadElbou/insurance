import { useState } from "react";
import {
  AlertTriangle,
  Globe,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { InsurerDomain } from "@insurance/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InsurerDomainsTableProps {
  domains: InsurerDomain[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (domain: InsurerDomain) => void;
  onToggle: (id: string, captureEnabled: boolean) => Promise<boolean> | boolean;
  onDelete: (id: string) => Promise<boolean> | boolean;
}

/**
 * Full listing of allow-listed insurer domains. Capture can be toggled
 * inline; edit / delete actions open dialogs managed by the page.
 */
export function InsurerDomainsTable({
  domains,
  isLoading,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: InsurerDomainsTableProps) {
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InsurerDomain | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleToggle(domain: InsurerDomain) {
    setPendingToggleId(domain.id);
    try {
      await onToggle(domain.id, !domain.capture_enabled);
    } finally {
      setPendingToggleId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const ok = await onDelete(confirmDelete.id);
      if (ok) setConfirmDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 bg-surface-container-low/30 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface">
              Domaines assureurs autorisés
            </h2>
            <p className="text-xs text-on-surface-variant">
              {domains.length}{" "}
              {domains.length > 1 ? "domaines déclarés" : "domaine déclaré"}
            </p>
          </div>
          <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un domaine
          </Button>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low/40">
                <th className="border-b border-outline-variant/10 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-outline">
                  Libellé
                </th>
                <th className="border-b border-outline-variant/10 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-outline">
                  Code
                </th>
                <th className="border-b border-outline-variant/10 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-outline">
                  Motif d'hôte
                </th>
                <th className="border-b border-outline-variant/10 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-outline">
                  Créé le
                </th>
                <th className="border-b border-outline-variant/10 px-6 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-outline">
                  Capture
                </th>
                <th className="border-b border-outline-variant/10 px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-outline">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : domains.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyRow onAdd={onAdd} />
                  </td>
                </tr>
              ) : (
                domains.map((domain) => {
                  const isToggling = pendingToggleId === domain.id;
                  return (
                    <tr
                      key={domain.id}
                      className="group transition-colors hover:bg-surface-container-low/60"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container/40 text-primary">
                            <ShieldCheck className="h-4 w-4" aria-hidden />
                          </div>
                          <span className="text-sm font-semibold text-on-surface">
                            {domain.label}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-block rounded-md bg-surface-container-low px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          {domain.insurer_code}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe
                            className="h-3.5 w-3.5 text-outline"
                            aria-hidden
                          />
                          <span className="truncate font-mono text-[13px] text-on-surface">
                            {domain.host_pattern}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm tabular-nums text-on-surface-variant">
                        {formatDate(domain.created_at)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={domain.capture_enabled}
                            disabled={isToggling}
                            onCheckedChange={() => handleToggle(domain)}
                            aria-label={
                              domain.capture_enabled
                                ? "Désactiver la capture"
                                : "Activer la capture"
                            }
                          />
                          <span
                            className={cn(
                              "text-[11px] font-semibold uppercase tracking-wide",
                              domain.capture_enabled
                                ? "text-secondary"
                                : "text-outline",
                            )}
                          >
                            {domain.capture_enabled ? "Actif" : "Pausé"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-outline transition-all hover:bg-white hover:text-primary"
                            onClick={() => onEdit(domain)}
                            aria-label={`Modifier ${domain.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-outline transition-all hover:bg-white hover:text-error"
                            onClick={() => setConfirmDelete(domain)}
                            aria-label={`Supprimer ${domain.label}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setConfirmDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-error-container/50 text-error">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <DialogTitle>Supprimer ce domaine ?</DialogTitle>
            <DialogDescription>
              Cette action retire{" "}
              <strong className="font-semibold text-on-surface">
                {confirmDelete?.label}
              </strong>{" "}
              de la liste d'autorisations. Les événements déjà capturés ne
              sont pas supprimés mais aucun nouveau portail ne pourra être
              ouvert pour ce domaine.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3 text-xs text-on-surface">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-error"
              aria-hidden
            />
            <p>
              Motif d'hôte supprimé:{" "}
              <code className="font-mono font-semibold">
                {confirmDelete?.host_pattern}
              </code>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(null)}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {isDeleting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmptyRow({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/30">
        <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-on-surface">
        Aucun domaine assureur déclaré
      </h3>
      <p className="max-w-md text-sm text-on-surface-variant">
        Ajoutez un domaine autorisé pour permettre aux gestionnaires et aux
        courtiers d'ouvrir les portails assureurs depuis l'application.
      </p>
      <Button onClick={onAdd} size="sm" className="gap-2">
        <Plus className="h-4 w-4" aria-hidden />
        Ajouter le premier domaine
      </Button>
    </div>
  );
}

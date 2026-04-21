import { useState } from "react";
import {
  ChevronRight,
  ShieldCheck,
  ShieldX,
  SparklesIcon,
} from "lucide-react";
import type { InsurerDomain, InsurerDomainInput } from "@insurance/shared";
import { useInsurerDomains } from "@/hooks/useInsurerDomains";
import { InsurerDomainsTable } from "@/components/scraper/InsurerDomainsTable";
import { InsurerDomainForm } from "@/components/scraper/InsurerDomainForm";
import { cn } from "@/lib/utils";

/**
 * Domaines assureurs — allow-list management for the portal scraper. The
 * Manager declares which insurer hosts the application is allowed to load
 * inside its embedded WebContentsView and whether traffic from each should
 * be captured into the ingestion pipeline.
 */
export function InsurerDomainsPage() {
  const {
    domains,
    isLoading,
    createDomain,
    updateDomain,
    toggleDomain,
    deleteDomain,
  } = useInsurerDomains();

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InsurerDomain | null>(null);
  const [isSaving, setSaving] = useState(false);

  const enabledCount = domains.filter((d) => d.capture_enabled).length;
  const disabledCount = domains.length - enabledCount;

  function handleAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(domain: InsurerDomain) {
    setEditing(domain);
    setFormOpen(true);
  }

  async function handleSubmit(input: InsurerDomainInput) {
    setSaving(true);
    try {
      if (editing) {
        await updateDomain(editing.id, input);
      } else {
        await createDomain(input);
      }
    } finally {
      setSaving(false);
    }
  }

  // The table's onToggle/onDelete expect a boolean indicating whether the
  // action actually succeeded. The hook throws on failures (toggle) or
  // silently swallows them (delete) — these adapters bridge both contracts.
  async function adaptToggle(
    id: string,
    captureEnabled: boolean,
  ): Promise<boolean> {
    try {
      await toggleDomain(id, captureEnabled);
      return true;
    } catch {
      return false;
    }
  }

  async function adaptDelete(id: string): Promise<boolean> {
    try {
      await deleteDomain(id);
      // Success is signalled by the id disappearing from the list — but the
      // hook already toasts on errors. Treat any resolved call as "safe to
      // close the confirmation dialog".
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-8 animate-fade-in">
      <header className="flex flex-col gap-3">
        <nav className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
          <span>Capture</span>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="text-primary">Domaines assureurs</span>
        </nav>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight text-on-surface">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/40 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              Domaines assureurs
            </h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Gérez la liste blanche des portails assureurs autorisés à
              s'ouvrir dans l'application et contrôlez ceux dont les
              événements sont capturés pour alimenter le pipeline.
            </p>
          </div>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={ShieldCheck}
          label="Domaines déclarés"
          value={domains.length}
          tone="primary"
          caption={
            domains.length > 1 ? "entrées dans l'allow-list" : "entrée déclarée"
          }
        />
        <SummaryCard
          icon={SparklesIcon}
          label="Capture active"
          value={enabledCount}
          tone="secondary"
          caption={
            enabledCount > 1
              ? "portails forwardent les événements"
              : "portail forwarde les événements"
          }
        />
        <SummaryCard
          icon={ShieldX}
          label="Capture suspendue"
          value={disabledCount}
          tone="outline"
          caption={
            disabledCount > 1
              ? "domaines pausés"
              : disabledCount === 1
                ? "domaine pausé"
                : "aucun domaine pausé"
          }
        />
      </section>

      {/* Table */}
      <InsurerDomainsTable
        domains={domains}
        isLoading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onToggle={adaptToggle}
        onDelete={adaptDelete}
      />

      <p className="text-xs italic text-on-surface-variant">
        Les événements déjà capturés sont conservés même si un domaine est
        supprimé — seules les futures ouvertures de portail sont bloquées.
      </p>

      {/* Create / edit dialog */}
      <InsurerDomainForm
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setFormOpen(false);
            setEditing(null);
          } else {
            setFormOpen(open);
          }
        }}
        initial={editing}
        isSaving={isSaving}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SummaryTone = "primary" | "secondary" | "outline";

const TONE_STYLES: Record<
  SummaryTone,
  { ring: string; text: string; bg: string }
> = {
  primary: {
    ring: "ring-primary/10",
    text: "text-primary",
    bg: "bg-primary-container/40",
  },
  secondary: {
    ring: "ring-secondary/10",
    text: "text-secondary",
    bg: "bg-secondary-container/40",
  },
  outline: {
    ring: "ring-outline/10",
    text: "text-outline",
    bg: "bg-surface-container-low",
  },
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  caption: string;
  tone: SummaryTone;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 ring-1 shadow-sm transition-colors",
        palette.ring,
      )}
    >
      <div
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          palette.bg,
          palette.text,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
          {label}
        </span>
        <span className="text-2xl font-extrabold tabular-nums text-on-surface leading-none">
          {value}
        </span>
        <span className="text-xs text-on-surface-variant">{caption}</span>
      </div>
    </div>
  );
}

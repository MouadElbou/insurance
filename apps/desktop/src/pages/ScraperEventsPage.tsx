import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  MinusCircle,
  Radio,
} from "lucide-react";
import { useScraperEvents } from "@/hooks/useScraperEvents";
import { useScraperEventsStore } from "@/stores/scraper.store";
import { useInsurerDomains } from "@/hooks/useInsurerDomains";
import { ScraperEventsFilters } from "@/components/scraper/ScraperEventsFilters";
import { ScraperEventsTable } from "@/components/scraper/ScraperEventsTable";
import { ScraperEventDrawer } from "@/components/scraper/ScraperEventDrawer";
import { cn } from "@/lib/utils";

/**
 * Événements scraper — paginated feed of every HTTP exchange captured while
 * an insurer portal was open. Manager-only surface: used to audit capture
 * quality, replay failed transformers, and drill into raw request/response
 * payloads through the side drawer.
 */
export function ScraperEventsPage() {
  const {
    events,
    pagination,
    filters,
    selectedEventId,
    isLoading,
    detail,
    isDetailLoading,
    isReplaying,
    selectEvent,
    replay,
  } = useScraperEvents();

  // The store exposes setters directly — the hook intentionally doesn't
  // forward them to keep the query layer thin.
  const setFilters = useScraperEventsStore((s) => s.setFilters);
  const resetFilters = useScraperEventsStore((s) => s.resetFilters);

  const { domains } = useInsurerDomains();

  // Breakdown cards — computed client-side from the current page so the
  // manager gets an immediate sense of the mix, without waiting on an extra
  // aggregate endpoint. These are scoped to the current page intentionally.
  const pageSummary = useMemo(() => {
    // IGNORED is a real verdict — the transformer looked at the event
    // and decided it wasn't an operation (keep-alives, polling probes,
    // static assets that slipped past the URL filter, etc). Surface it
    // so a manager can tell a healthy "95% ignored, 5% transformed" run
    // from a misconfigured "0% transformed" one without opening the table.
    const next = {
      total: events.length,
      transformed: 0,
      errors: 0,
      pending: 0,
      ignored: 0,
    };
    for (const ev of events) {
      if (ev.transformer_verdict === "TRANSFORMED") next.transformed += 1;
      else if (ev.transformer_verdict === "ERROR") next.errors += 1;
      else if (ev.transformer_verdict === "PENDING") next.pending += 1;
      else if (ev.transformer_verdict === "IGNORED") next.ignored += 1;
    }
    return next;
  }, [events]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-8 animate-fade-in">
      {/* Breadcrumb + heading */}
      <header className="flex flex-col gap-3">
        <nav className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
          <span>Capture</span>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="text-primary">Événements scraper</span>
        </nav>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight text-on-surface">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/40 text-primary">
                <Activity className="h-5 w-5" aria-hidden />
              </span>
              Événements scraper
            </h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Chaque appel HTTP capturé pendant qu'un portail assureur est
              ouvert est enregistré ici. Inspectez les corps, rejouez les
              transformeurs en erreur et suivez les opérations générées.
            </p>
          </div>
          <div className="hidden items-center gap-2 self-start rounded-full border border-primary/30 bg-primary-container/20 px-3 py-1 text-xs font-semibold text-primary md:inline-flex md:self-auto">
            <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden />
            Flux capture en direct
          </div>
        </div>
      </header>

      {/* Quick page-level summary */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard
          icon={Activity}
          label="Événements (page)"
          value={pageSummary.total}
          tone="primary"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Transformés"
          value={pageSummary.transformed}
          tone="secondary"
        />
        <SummaryCard
          icon={Clock}
          label="En attente"
          value={pageSummary.pending}
          tone="tertiary"
        />
        <SummaryCard
          icon={MinusCircle}
          label="Ignorés"
          value={pageSummary.ignored}
          tone="muted"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Erreurs"
          value={pageSummary.errors}
          tone="error"
        />
      </section>

      {/* Filters */}
      <ScraperEventsFilters
        filters={filters}
        domains={domains}
        onChange={(patch) => setFilters(patch)}
        onReset={resetFilters}
      />

      {/* Results table */}
      <div className="flex-1">
        <ScraperEventsTable
          events={events}
          isLoading={isLoading}
          pagination={pagination}
          onPageChange={(page) => setFilters({ page })}
          onRowClick={(id) => selectEvent(id)}
          onReplay={(id) => replay(id)}
        />
      </div>

      {/* Footer caption */}
      <p className="text-xs italic text-on-surface-variant">
        Les événements sont conservés selon votre politique de rétention. Les
        corps volumineux sont automatiquement tronqués après capture.
      </p>

      {/* Detail drawer */}
      <ScraperEventDrawer
        open={Boolean(selectedEventId)}
        onOpenChange={(open) => {
          if (!open) selectEvent(null);
        }}
        detail={detail}
        isDetailLoading={isDetailLoading}
        isReplaying={isReplaying}
        onReplay={(id) => replay(id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

type SummaryTone = "primary" | "secondary" | "tertiary" | "error" | "muted";

const TONE_STYLES: Record<SummaryTone, { ring: string; text: string; bg: string }> = {
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
  tertiary: {
    ring: "ring-tertiary/10",
    text: "text-tertiary",
    bg: "bg-tertiary-container/40",
  },
  error: {
    ring: "ring-error/10",
    text: "text-error",
    bg: "bg-error-container/40",
  },
  // Muted reads as informational / non-actionable — used for IGNORED events
  // so a page full of IGNORED doesn't look like pending work to a manager.
  muted: {
    ring: "ring-outline/10",
    text: "text-on-surface-variant",
    bg: "bg-surface-container-low",
  },
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone: SummaryTone;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 ring-1 shadow-sm transition-colors",
        palette.ring,
      )}
    >
      <div
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          palette.bg,
          palette.text,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
          {label}
        </span>
        <span className="text-2xl font-extrabold tabular-nums text-on-surface">
          {value}
        </span>
      </div>
    </div>
  );
}

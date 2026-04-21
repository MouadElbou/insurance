import { FormEvent, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type {
  InsurerDomain,
  ScraperEventsQuery,
} from "@insurance/shared";
import { Button } from "@/components/ui/button";

interface ScraperEventsFiltersProps {
  filters: ScraperEventsQuery;
  domains: InsurerDomain[];
  onChange: (patch: Partial<ScraperEventsQuery>) => void;
  onReset: () => void;
}

const VERDICT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tous verdicts" },
  { value: "pending", label: "En attente" },
  { value: "transformed", label: "Transformé" },
  { value: "ignored", label: "Ignoré" },
  { value: "error", label: "Erreur" },
];

/**
 * Compact filter bar used above the scraper events table. Search input is
 * debounced (300 ms) so typing doesn't thrash the backend.
 */
export function ScraperEventsFilters({
  filters,
  domains,
  onChange,
  onReset,
}: ScraperEventsFiltersProps) {
  const [searchDraft, setSearchDraft] = useState(filters.q ?? "");

  // Debounce free-text search
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if ((filters.q ?? "") !== searchDraft) {
        onChange({ q: searchDraft || undefined, page: 1 });
      }
    }, 300);
    return () => window.clearTimeout(handle);
    // filters.q intentionally omitted from deps to avoid a ping-pong loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, onChange]);

  // Keep local draft aligned with external resets
  useEffect(() => {
    setSearchDraft(filters.q ?? "");
  }, [filters.q]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    onChange({ q: searchDraft || undefined, page: 1 });
  }

  const hasActive =
    Boolean(filters.q) ||
    Boolean(filters.insurer_code) ||
    Boolean(filters.verdict) ||
    Boolean(filters.host) ||
    Boolean(filters.from) ||
    Boolean(filters.to);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
      <form
        onSubmit={submitSearch}
        className="relative min-w-[220px] flex-1"
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline"
          aria-hidden
        />
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Rechercher URL, opérateur, hôte..."
          className="w-full rounded-lg border-none bg-surface-container-lowest py-2.5 pr-3 pl-10 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:outline-none"
          aria-label="Rechercher"
        />
      </form>

      <select
        value={filters.insurer_code ?? ""}
        onChange={(e) =>
          onChange({
            insurer_code: e.target.value || undefined,
            page: 1,
          })
        }
        className="cursor-pointer rounded-lg border-none bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:outline-none"
      >
        <option value="">Assureur: Tous</option>
        {domains.map((d) => (
          <option key={d.id} value={d.insurer_code}>
            {d.label}
          </option>
        ))}
      </select>

      <select
        value={filters.verdict ?? ""}
        onChange={(e) =>
          onChange({
            verdict:
              (e.target.value as ScraperEventsQuery["verdict"]) || undefined,
            page: 1,
          })
        }
        className="cursor-pointer rounded-lg border-none bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:outline-none"
      >
        {VERDICT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={filters.from ?? ""}
        onChange={(e) => onChange({ from: e.target.value || undefined, page: 1 })}
        className="rounded-lg border-none bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:outline-none"
        aria-label="Date de début"
      />
      <input
        type="date"
        value={filters.to ?? ""}
        onChange={(e) => onChange({ to: e.target.value || undefined, page: 1 })}
        className="rounded-lg border-none bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:outline-none"
        aria-label="Date de fin"
      />

      {hasActive ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onReset}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Réinitialiser
        </Button>
      ) : null}
    </div>
  );
}

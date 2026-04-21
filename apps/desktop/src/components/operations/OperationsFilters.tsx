import { useOperationsStore } from "@/stores/operations.store";
import { Search, SlidersHorizontal } from "lucide-react";

export function OperationsFilters() {
  const filters = useOperationsStore((s) => s.filters);
  const setFilters = useOperationsStore((s) => s.setFilters);

  return (
    <div className="bg-surface-container-low p-4 rounded-xl flex flex-wrap items-center gap-4">
      {/* Search */}
      <div className="flex-1 min-w-[200px] relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline h-4 w-4" />
        <input
          type="text"
          placeholder="Police ou Assuré..."
          value={filters.search || ""}
          onChange={(e) =>
            setFilters({ search: e.target.value || undefined })
          }
          className="w-full bg-surface-container-lowest border-none rounded-lg pl-10 text-sm py-2.5 focus:ring-2 focus:ring-primary/20 focus:outline-none text-on-surface placeholder:text-outline"
        />
      </div>

      {/* Select filters */}
      <div className="flex items-center gap-2">
        <select
          className="bg-surface-container-lowest border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-primary/20 focus:outline-none text-on-surface-variant font-medium cursor-pointer"
          value={filters.date_from ? "custom" : "all"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "all") {
              setFilters({ date_from: undefined, date_to: undefined });
            } else if (v === "today") {
              const today = new Date().toISOString().split("T")[0];
              setFilters({ date_from: today, date_to: today });
            } else if (v === "month") {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1)
                .toISOString()
                .split("T")[0];
              setFilters({ date_from: start, date_to: undefined });
            } else if (v === "quarter") {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
                .toISOString()
                .split("T")[0];
              setFilters({ date_from: start, date_to: undefined });
            }
          }}
        >
          <option value="all">Toutes les dates</option>
          <option value="today">Aujourd&apos;hui</option>
          <option value="month">Ce mois</option>
          <option value="quarter">Dernier trimestre</option>
        </select>

        <select
          className="bg-surface-container-lowest border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-primary/20 focus:outline-none text-on-surface-variant font-medium cursor-pointer"
          value={filters.type || "ALL"}
          onChange={(e) =>
            setFilters({
              type:
                e.target.value === "ALL"
                  ? undefined
                  : (e.target.value as "PRODUCTION" | "EMISSION"),
            })
          }
        >
          <option value="ALL">Type: Tous</option>
          <option value="PRODUCTION">Production</option>
          <option value="EMISSION">Émission</option>
        </select>

        <select
          className="bg-surface-container-lowest border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-primary/20 focus:outline-none text-on-surface-variant font-medium cursor-pointer"
          value={filters.source || "ALL"}
          onChange={(e) =>
            setFilters({
              source:
                e.target.value === "ALL"
                  ? undefined
                  : (e.target.value as "EXCEL" | "MANUAL" | "SCRAPER"),
            })
          }
        >
          <option value="ALL">Source: Toutes</option>
          <option value="EXCEL">Excel</option>
          <option value="MANUAL">Manuel</option>
          <option value="SCRAPER">Scraper</option>
        </select>

        <select
          className="bg-surface-container-lowest border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-primary/20 focus:outline-none text-on-surface-variant font-medium cursor-pointer"
          defaultValue="ALL"
        >
          <option value="ALL">Assureur: Tous</option>
          <option value="saham">Saham</option>
          <option value="axa">AXA</option>
          <option value="wafa">Wafa</option>
          <option value="rma">RMA</option>
        </select>
      </div>

      {/* Filter icon button */}
      <button className="p-2.5 bg-surface-container-lowest text-outline rounded-lg hover:text-primary transition-all">
        <SlidersHorizontal className="h-5 w-5" />
      </button>
    </div>
  );
}

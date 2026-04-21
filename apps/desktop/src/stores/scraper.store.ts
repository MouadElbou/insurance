import { create } from "zustand";
import type {
  InsurerDomain,
  PaginatedResponse,
  PortalStatus,
  ScraperEventListItem,
  ScraperEventStats,
  ScraperEventsQuery,
} from "@insurance/shared";

// --------------------------------------------------------------- //
// Portal state — tracks the WebContentsView opened in main
// --------------------------------------------------------------- //

const defaultPortalStatus: PortalStatus = {
  status: "IDLE",
  insurer_code: null,
  url: null,
  captured_count: 0,
  last_flush_at: null,
  last_error: null,
};

interface PortalState {
  status: PortalStatus;
  stats: ScraperEventStats | null;
  setStatus: (status: PortalStatus) => void;
  setStats: (stats: ScraperEventStats | null) => void;
  reset: () => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  status: { ...defaultPortalStatus },
  stats: null,
  setStatus: (status) => set({ status }),
  setStats: (stats) => set({ stats }),
  reset: () =>
    set({ status: { ...defaultPortalStatus }, stats: null }),
}));

// --------------------------------------------------------------- //
// Scraper events state — MANAGER reporting page
// --------------------------------------------------------------- //

const defaultEventsFilters: ScraperEventsQuery = {
  page: 1,
  page_size: 25,
};

interface ScraperEventsState {
  events: ScraperEventListItem[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  filters: ScraperEventsQuery;
  selectedEventId: string | null;
  isLoading: boolean;
  setEvents: (data: PaginatedResponse<ScraperEventListItem>) => void;
  setFilters: (filters: Partial<ScraperEventsQuery>) => void;
  resetFilters: () => void;
  selectEvent: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useScraperEventsStore = create<ScraperEventsState>((set) => ({
  events: [],
  pagination: { page: 1, per_page: 25, total_items: 0, total_pages: 0 },
  filters: { ...defaultEventsFilters },
  selectedEventId: null,
  isLoading: true,

  setEvents: (data) =>
    set({
      events: data.items,
      pagination: data.pagination,
      isLoading: false,
    }),

  setFilters: (filters) =>
    set((state) => ({
      filters: {
        ...state.filters,
        ...filters,
        page: filters.page ?? 1,
      },
    })),

  resetFilters: () => set({ filters: { ...defaultEventsFilters } }),

  selectEvent: (id) => set({ selectedEventId: id }),

  setLoading: (loading) => set({ isLoading: loading }),
}));

// --------------------------------------------------------------- //
// Insurer domains state — admin allowlist manager
// --------------------------------------------------------------- //

interface InsurerDomainsState {
  domains: InsurerDomain[];
  isLoading: boolean;
  setDomains: (domains: InsurerDomain[]) => void;
  setLoading: (loading: boolean) => void;
  upsert: (domain: InsurerDomain) => void;
  remove: (id: string) => void;
}

export const useInsurerDomainsStore = create<InsurerDomainsState>((set) => ({
  domains: [],
  isLoading: true,

  setDomains: (domains) => set({ domains, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  upsert: (domain) =>
    set((state) => {
      const idx = state.domains.findIndex((d) => d.id === domain.id);
      if (idx === -1) return { domains: [domain, ...state.domains] };
      const next = state.domains.slice();
      next[idx] = domain;
      return { domains: next };
    }),

  remove: (id) =>
    set((state) => ({
      domains: state.domains.filter((d) => d.id !== id),
    })),
}));

import { create } from "zustand";
import type {
  Operation,
  OperationFilters,
  PaginatedResponse,
} from "@insurance/shared";

interface OperationsState {
  operations: Operation[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  filters: OperationFilters;
  selectedOperation: Operation | null;
  isLoading: boolean;
  setOperations: (data: PaginatedResponse<Operation>) => void;
  setFilters: (filters: Partial<OperationFilters>) => void;
  resetFilters: () => void;
  selectOperation: (op: Operation | null) => void;
  setLoading: (loading: boolean) => void;
}

const defaultFilters: OperationFilters = {
  page: 1,
  per_page: 25,
  sort_by: "created_at",
  sort_order: "desc",
};

export const useOperationsStore = create<OperationsState>((set) => ({
  operations: [],
  pagination: { page: 1, per_page: 25, total_items: 0, total_pages: 0 },
  filters: { ...defaultFilters },
  selectedOperation: null,
  isLoading: true,

  setOperations: (data) =>
    set({
      operations: data.items,
      pagination: data.pagination,
      isLoading: false,
    }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters, page: filters.page ?? 1 },
    })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  selectOperation: (op) => set({ selectedOperation: op }),

  setLoading: (loading) => set({ isLoading: loading }),
}));

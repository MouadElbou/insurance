import { create } from "zustand";
import type { Employee, PaginatedResponse } from "@insurance/shared";

interface EmployeesState {
  employees: Employee[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  selectedEmployee: Employee | null;
  searchQuery: string;
  isLoading: boolean;
  setEmployees: (data: PaginatedResponse<Employee>) => void;
  setEmployeesList: (employees: Employee[]) => void;
  selectEmployee: (emp: Employee | null) => void;
  setSearchQuery: (query: string) => void;
  updateEmployee: (emp: Employee) => void;
  removeEmployee: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useEmployeesStore = create<EmployeesState>((set) => ({
  employees: [],
  pagination: { page: 1, per_page: 100, total_items: 0, total_pages: 0 },
  selectedEmployee: null,
  searchQuery: "",
  isLoading: true,

  setEmployees: (data) =>
    set({
      employees: data.items,
      pagination: data.pagination,
      isLoading: false,
    }),

  setEmployeesList: (employees) => set({ employees, isLoading: false }),

  selectEmployee: (emp) => set({ selectedEmployee: emp }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  updateEmployee: (emp) =>
    set((state) => ({
      employees: state.employees.map((e) => (e.id === emp.id ? emp : e)),
    })),

  removeEmployee: (id) =>
    set((state) => ({
      employees: state.employees.filter((e) => e.id !== id),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));

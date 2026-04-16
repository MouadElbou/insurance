import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useEmployeesStore } from "@/stores/employees.store";
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  PaginatedResponse,
} from "@insurance/shared";
import { toast } from "sonner";

export function useEmployees() {
  const {
    employees,
    selectedEmployee,
    searchQuery,
    isLoading,
    setEmployees,
    selectEmployee,
    updateEmployee: updateInStore,
    setLoading,
  } = useEmployeesStore();

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Employee>>(
        "employees?per_page=100",
      );
      setEmployees(data);
    } catch {
      toast.error("Erreur lors du chargement des employes");
      setLoading(false);
    }
  }, [setEmployees, setLoading]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = useCallback(
    async (data: CreateEmployeeRequest) => {
      try {
        await api.post<Employee>("employees", data);
        toast.success("Employe cree avec succes");
        fetchEmployees();
      } catch (err: any) {
        const message =
          err?.response
            ? (await err.response.json().catch(() => null))?.error?.message
            : null;
        toast.error(message || "Erreur lors de la creation de l'employe");
        throw err;
      }
    },
    [fetchEmployees],
  );

  const updateEmployee = useCallback(
    async (id: string, data: UpdateEmployeeRequest) => {
      try {
        const updated = await api.patch<Employee>(`employees/${id}`, data);
        updateInStore(updated);
        toast.success("Employe mis a jour");
      } catch (err: any) {
        const message =
          err?.response
            ? (await err.response.json().catch(() => null))?.error?.message
            : null;
        toast.error(message || "Erreur lors de la mise a jour");
        throw err;
      }
    },
    [updateInStore],
  );

  const deleteEmployee = useCallback(
    async (id: string) => {
      try {
        await api.delete(`employees/${id}`);
        toast.success("Employe desactive");
        fetchEmployees();
      } catch {
        toast.error("Erreur lors de la desactivation");
      }
    },
    [fetchEmployees],
  );

  // Filter employees by search query
  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.operator_code.toLowerCase().includes(q)
    );
  });

  return {
    employees: filteredEmployees,
    allEmployees: employees,
    selectedEmployee,
    selectEmployee,
    searchQuery,
    isLoading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refetch: fetchEmployees,
  };
}

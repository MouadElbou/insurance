import { useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useOperationsStore } from "@/stores/operations.store";
import type { Operation, PaginatedResponse } from "@insurance/shared";
import { toast } from "sonner";

export function useOperations() {
  const {
    operations,
    pagination,
    filters,
    selectedOperation,
    isLoading,
    setOperations,
    setLoading,
    selectOperation,
  } = useOperationsStore();
  const abortRef = useRef<AbortController | null>(null);

  const fetchOperations = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      // Build search params from filters
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      });

      const data = await api.get<PaginatedResponse<Operation>>(
        `operations?${params.toString()}`,
        { signal: abortRef.current.signal },
      );
      setOperations(data);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Erreur lors du chargement des operations");
        setLoading(false);
      }
    }
  }, [filters, setOperations, setLoading]);

  useEffect(() => {
    fetchOperations();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchOperations]);

  return {
    operations,
    pagination,
    filters,
    selectedOperation,
    isLoading,
    selectOperation,
    refetch: fetchOperations,
  };
}

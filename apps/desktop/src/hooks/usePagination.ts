import { useState, useCallback, useMemo } from "react";
import { ITEMS_PER_PAGE } from "@/lib/constants";

interface UsePaginationOptions {
  initialPage?: number;
  initialPerPage?: number;
  totalItems?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const [page, setPage] = useState(options.initialPage ?? 1);
  const [perPage, setPerPage] = useState(
    options.initialPerPage ?? ITEMS_PER_PAGE,
  );

  const totalPages = useMemo(() => {
    if (!options.totalItems) return 0;
    return Math.ceil(options.totalItems / perPage);
  }, [options.totalItems, perPage]);

  const goToPage = useCallback(
    (newPage: number) => {
      setPage(Math.max(1, Math.min(newPage, totalPages || 1)));
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(page - 1);
  }, [page, goToPage]);

  return {
    page,
    perPage,
    totalPages,
    setPage: goToPage,
    setPerPage,
    nextPage,
    prevPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

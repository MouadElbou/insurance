import { describe, it, expect, beforeEach } from "vitest";
import { useOperationsStore } from "../../src/stores/operations.store";
import type { Operation, PaginatedResponse } from "@insurance/shared";

function resetStore() {
  useOperationsStore.setState({
    operations: [],
    pagination: { page: 1, per_page: 25, total_items: 0, total_pages: 0 },
    filters: {
      page: 1,
      per_page: 25,
      sort_by: "created_at",
      sort_order: "desc",
    },
    selectedOperation: null,
    isLoading: true,
  });
}

function createMockOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op-1",
    type: "PRODUCTION",
    source: "EXCEL",
    client_id: "c-1",
    client_name: "Acme Corp",
    policy_number: "POL-001",
    avenant_number: null,
    quittance_number: null,
    attestation_number: null,
    policy_status: "ACTIVE",
    event_type: null,
    emission_date: "2025-01-15T00:00:00.000Z",
    effective_date: "2025-02-01T00:00:00.000Z",
    prime_net: "1500.00",
    tax_amount: "150.00",
    parafiscal_tax: "10.00",
    total_prime: "1660.00",
    commission: "225.00",
    employee_id: "emp-1",
    employee_name: "Ahmed Benali",
    upload_id: "upl-1",
    created_at: "2025-01-15T10:00:00.000Z",
    updated_at: "2025-01-15T10:00:00.000Z",
    ...overrides,
  };
}

function createMockPaginatedResponse(
  items: Operation[],
  pagination?: Partial<PaginatedResponse<Operation>["pagination"]>,
): PaginatedResponse<Operation> {
  return {
    items,
    pagination: {
      page: 1,
      per_page: 25,
      total_items: items.length,
      total_pages: 1,
      ...pagination,
    },
  };
}

describe("useOperationsStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("should have empty operations and default pagination", () => {
      const state = useOperationsStore.getState();
      expect(state.operations).toEqual([]);
      expect(state.pagination).toEqual({
        page: 1,
        per_page: 25,
        total_items: 0,
        total_pages: 0,
      });
    });

    it("should have default filters", () => {
      const state = useOperationsStore.getState();
      expect(state.filters).toEqual({
        page: 1,
        per_page: 25,
        sort_by: "created_at",
        sort_order: "desc",
      });
    });

    it("should have no selected operation", () => {
      expect(useOperationsStore.getState().selectedOperation).toBeNull();
    });

    it("should start with isLoading true", () => {
      expect(useOperationsStore.getState().isLoading).toBe(true);
    });
  });

  describe("setOperations", () => {
    it("should set operations and pagination from paginated response", () => {
      const ops = [createMockOperation(), createMockOperation({ id: "op-2" })];
      const response = createMockPaginatedResponse(ops, {
        total_items: 50,
        total_pages: 2,
      });

      useOperationsStore.getState().setOperations(response);
      const state = useOperationsStore.getState();

      expect(state.operations).toHaveLength(2);
      expect(state.pagination.total_items).toBe(50);
      expect(state.pagination.total_pages).toBe(2);
    });

    it("should set isLoading to false", () => {
      const response = createMockPaginatedResponse([]);
      useOperationsStore.getState().setOperations(response);
      expect(useOperationsStore.getState().isLoading).toBe(false);
    });

    it("should replace previous operations entirely", () => {
      const first = createMockPaginatedResponse([createMockOperation()]);
      useOperationsStore.getState().setOperations(first);
      expect(useOperationsStore.getState().operations).toHaveLength(1);

      const second = createMockPaginatedResponse([
        createMockOperation({ id: "op-a" }),
        createMockOperation({ id: "op-b" }),
        createMockOperation({ id: "op-c" }),
      ]);
      useOperationsStore.getState().setOperations(second);
      expect(useOperationsStore.getState().operations).toHaveLength(3);
      expect(useOperationsStore.getState().operations[0].id).toBe("op-a");
    });

    it("should handle empty items array", () => {
      const response = createMockPaginatedResponse([], {
        total_items: 0,
        total_pages: 0,
      });
      useOperationsStore.getState().setOperations(response);
      const state = useOperationsStore.getState();
      expect(state.operations).toEqual([]);
      expect(state.pagination.total_items).toBe(0);
    });
  });

  describe("setFilters", () => {
    it("should merge partial filters into existing", () => {
      useOperationsStore.getState().setFilters({ type: "PRODUCTION" });
      const state = useOperationsStore.getState();
      expect(state.filters.type).toBe("PRODUCTION");
      expect(state.filters.sort_by).toBe("created_at");
      expect(state.filters.per_page).toBe(25);
    });

    it("should reset page to 1 when filters change without explicit page", () => {
      useOperationsStore.getState().setFilters({ page: 3 });
      expect(useOperationsStore.getState().filters.page).toBe(3);

      useOperationsStore.getState().setFilters({ search: "test" });
      expect(useOperationsStore.getState().filters.page).toBe(1);
    });

    it("should keep explicit page when provided", () => {
      useOperationsStore.getState().setFilters({ page: 5, type: "EMISSION" });
      const state = useOperationsStore.getState();
      expect(state.filters.page).toBe(5);
      expect(state.filters.type).toBe("EMISSION");
    });

    it("should allow setting sort_by", () => {
      useOperationsStore.getState().setFilters({ sort_by: "prime_net" });
      expect(useOperationsStore.getState().filters.sort_by).toBe("prime_net");
    });

    it("should allow setting sort_order", () => {
      useOperationsStore.getState().setFilters({ sort_order: "asc" });
      expect(useOperationsStore.getState().filters.sort_order).toBe("asc");
    });

    it("should allow setting employee_id filter", () => {
      useOperationsStore
        .getState()
        .setFilters({ employee_id: "emp-specific" });
      expect(useOperationsStore.getState().filters.employee_id).toBe(
        "emp-specific",
      );
    });

    it("should allow setting date range filters", () => {
      useOperationsStore.getState().setFilters({
        date_from: "2025-01-01",
        date_to: "2025-12-31",
      });
      const state = useOperationsStore.getState();
      expect(state.filters.date_from).toBe("2025-01-01");
      expect(state.filters.date_to).toBe("2025-12-31");
    });

    it("should handle multiple sequential filter updates", () => {
      useOperationsStore.getState().setFilters({ type: "PRODUCTION" });
      useOperationsStore.getState().setFilters({ source: "MANUAL" });
      useOperationsStore.getState().setFilters({ search: "policy" });
      const state = useOperationsStore.getState();
      expect(state.filters.type).toBe("PRODUCTION");
      expect(state.filters.source).toBe("MANUAL");
      expect(state.filters.search).toBe("policy");
    });
  });

  describe("resetFilters", () => {
    it("should restore default filters", () => {
      useOperationsStore.getState().setFilters({
        type: "EMISSION",
        search: "test",
        page: 5,
        sort_by: "prime_net",
        sort_order: "asc",
      });

      useOperationsStore.getState().resetFilters();
      const state = useOperationsStore.getState();

      expect(state.filters).toEqual({
        page: 1,
        per_page: 25,
        sort_by: "created_at",
        sort_order: "desc",
      });
    });

    it("should clear optional filter fields", () => {
      useOperationsStore.getState().setFilters({
        type: "PRODUCTION",
        employee_id: "emp-1",
        search: "test",
        date_from: "2025-01-01",
      });

      useOperationsStore.getState().resetFilters();
      const state = useOperationsStore.getState();

      expect(state.filters.type).toBeUndefined();
      expect(state.filters.employee_id).toBeUndefined();
      expect(state.filters.search).toBeUndefined();
      expect(state.filters.date_from).toBeUndefined();
    });
  });

  describe("selectOperation", () => {
    it("should set the selected operation", () => {
      const op = createMockOperation();
      useOperationsStore.getState().selectOperation(op);
      expect(useOperationsStore.getState().selectedOperation).toEqual(op);
    });

    it("should allow deselecting with null", () => {
      useOperationsStore.getState().selectOperation(createMockOperation());
      useOperationsStore.getState().selectOperation(null);
      expect(useOperationsStore.getState().selectedOperation).toBeNull();
    });

    it("should replace previously selected operation", () => {
      useOperationsStore.getState().selectOperation(createMockOperation());
      const second = createMockOperation({ id: "op-2", client_name: "Other" });
      useOperationsStore.getState().selectOperation(second);
      expect(useOperationsStore.getState().selectedOperation?.id).toBe("op-2");
    });
  });

  describe("setLoading", () => {
    it("should set isLoading to true", () => {
      useOperationsStore.getState().setLoading(true);
      expect(useOperationsStore.getState().isLoading).toBe(true);
    });

    it("should set isLoading to false", () => {
      useOperationsStore.getState().setLoading(false);
      expect(useOperationsStore.getState().isLoading).toBe(false);
    });

    it("should not affect operations or filters", () => {
      const ops = [createMockOperation()];
      useOperationsStore
        .getState()
        .setOperations(createMockPaginatedResponse(ops));
      useOperationsStore.getState().setFilters({ type: "PRODUCTION" });
      useOperationsStore.getState().setLoading(true);

      const state = useOperationsStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.operations).toHaveLength(1);
      expect(state.filters.type).toBe("PRODUCTION");
    });
  });
});

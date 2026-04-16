import { describe, it, expect } from "vitest";
import {
  createOperationSchema,
  operationFiltersSchema,
} from "../../src/schemas/operation.schema.js";

describe("createOperationSchema", () => {
  const validInput = {
    type: "PRODUCTION",
    policy_number: "POL-001",
  };

  it("should accept valid minimal input", () => {
    const result = createOperationSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should accept full input with all optional fields", () => {
    const result = createOperationSchema.safeParse({
      type: "EMISSION",
      policy_number: "POL-002",
      client_id: "C-123",
      client_name: "Test Client",
      avenant_number: "AV-01",
      quittance_number: "QT-01",
      attestation_number: "ATT-01",
      policy_status: "ACTIVE",
      event_type: "CREATION",
      emission_date: "2025-06-15T10:00:00.000Z",
      effective_date: "2025-07-01T00:00:00.000Z",
      prime_net: "1000.50",
      tax_amount: "100.05",
      parafiscal_tax: "50",
      total_prime: "1150.55",
      commission: "200.10",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid type", () => {
    const result = createOperationSchema.safeParse({
      type: "INVALID",
      policy_number: "POL-001",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty policy_number", () => {
    const result = createOperationSchema.safeParse({
      type: "PRODUCTION",
      policy_number: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid decimal format for prime_net", () => {
    const result = createOperationSchema.safeParse({
      ...validInput,
      prime_net: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("should accept decimal with two places", () => {
    const result = createOperationSchema.safeParse({
      ...validInput,
      prime_net: "1234.56",
    });
    expect(result.success).toBe(true);
  });

  it("should reject decimal with three decimal places", () => {
    const result = createOperationSchema.safeParse({
      ...validInput,
      prime_net: "1234.567",
    });
    expect(result.success).toBe(false);
  });

  it("should accept integer as decimal string", () => {
    const result = createOperationSchema.safeParse({
      ...validInput,
      prime_net: "1000",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid datetime for emission_date", () => {
    const result = createOperationSchema.safeParse({
      ...validInput,
      emission_date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing type", () => {
    const result = createOperationSchema.safeParse({
      policy_number: "POL-001",
    });
    expect(result.success).toBe(false);
  });
});

describe("operationFiltersSchema", () => {
  it("should apply defaults for pagination", () => {
    const result = operationFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(25);
      expect(result.data.sort_by).toBe("created_at");
      expect(result.data.sort_order).toBe("desc");
    }
  });

  it("should coerce string page to number", () => {
    const result = operationFiltersSchema.safeParse({ page: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
    }
  });

  it("should reject negative page", () => {
    const result = operationFiltersSchema.safeParse({ page: "-1" });
    expect(result.success).toBe(false);
  });

  it("should reject page 0", () => {
    const result = operationFiltersSchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("should reject per_page greater than 100", () => {
    const result = operationFiltersSchema.safeParse({ per_page: "200" });
    expect(result.success).toBe(false);
  });

  it("should accept valid type filter", () => {
    const result = operationFiltersSchema.safeParse({ type: "PRODUCTION" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid type filter", () => {
    const result = operationFiltersSchema.safeParse({ type: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("should accept valid source filter", () => {
    const result = operationFiltersSchema.safeParse({ source: "EXCEL" });
    expect(result.success).toBe(true);
  });

  it("should accept valid sort_by values", () => {
    for (const sortBy of ["created_at", "effective_date", "emission_date", "prime_net", "total_prime"]) {
      const result = operationFiltersSchema.safeParse({ sort_by: sortBy });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid sort_by", () => {
    const result = operationFiltersSchema.safeParse({ sort_by: "invalid_field" });
    expect(result.success).toBe(false);
  });

  it("should accept search string up to 100 chars", () => {
    const result = operationFiltersSchema.safeParse({ search: "test search" });
    expect(result.success).toBe(true);
  });

  it("should reject search string over 100 chars", () => {
    const result = operationFiltersSchema.safeParse({ search: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("should accept valid UUID for employee_id", () => {
    const result = operationFiltersSchema.safeParse({
      employee_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-UUID for employee_id", () => {
    const result = operationFiltersSchema.safeParse({
      employee_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "../../src/schemas/employee.schema.js";

describe("createEmployeeSchema", () => {
  const validInput = {
    email: "john@company.com",
    password: "securepass123",
    full_name: "John Doe",
    operator_code: "int46442",
    role: "EMPLOYEE",
  };

  it("should accept valid input", () => {
    const result = createEmployeeSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      email: "not-email",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short full_name", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      full_name: "A",
    });
    expect(result.success).toBe(false);
  });

  it("should reject operator_code with special characters", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      operator_code: "int-123!",
    });
    expect(result.success).toBe(false);
  });

  it("should accept alphanumeric operator_code", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      operator_code: "int46442",
    });
    expect(result.success).toBe(true);
  });

  it("should accept MANAGER role", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      role: "MANAGER",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid role", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty operator_code", () => {
    const result = createEmployeeSchema.safeParse({
      ...validInput,
      operator_code: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing fields", () => {
    const result = createEmployeeSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("updateEmployeeSchema", () => {
  it("should accept partial updates", () => {
    const result = updateEmployeeSchema.safeParse({
      full_name: "Updated Name",
    });
    expect(result.success).toBe(true);
  });

  it("should accept an empty object (no fields to update)", () => {
    const result = updateEmployeeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject invalid email when provided", () => {
    const result = updateEmployeeSchema.safeParse({
      email: "not-email",
    });
    expect(result.success).toBe(false);
  });

  it("should accept is_active boolean", () => {
    const result = updateEmployeeSchema.safeParse({
      is_active: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(false);
    }
  });

  it("should reject is_active non-boolean", () => {
    const result = updateEmployeeSchema.safeParse({
      is_active: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password when provided", () => {
    const result = updateEmployeeSchema.safeParse({
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

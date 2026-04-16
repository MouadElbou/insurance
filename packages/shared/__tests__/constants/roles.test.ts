import { describe, it, expect } from "vitest";
import { ROLES } from "../../src/constants/roles.js";

describe("ROLES", () => {
  it("should define MANAGER role", () => {
    expect(ROLES.MANAGER).toBe("MANAGER");
  });

  it("should define EMPLOYEE role", () => {
    expect(ROLES.EMPLOYEE).toBe("EMPLOYEE");
  });

  it("should have exactly 2 roles", () => {
    expect(Object.keys(ROLES)).toHaveLength(2);
  });
});

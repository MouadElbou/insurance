import { describe, it, expect } from "vitest";
import {
  DATE_FORMAT_FR,
  DATETIME_FORMAT_FR,
  TIME_FORMAT_FR,
} from "../../src/utils/date.js";

describe("date constants (shared)", () => {
  it("should export correct French date format", () => {
    expect(DATE_FORMAT_FR).toBe("dd/MM/yyyy");
  });

  it("should export correct French datetime format", () => {
    expect(DATETIME_FORMAT_FR).toBe("dd/MM/yyyy HH:mm");
  });

  it("should export correct French time format", () => {
    expect(TIME_FORMAT_FR).toBe("HH:mm");
  });
});

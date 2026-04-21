/**
 * Unit tests for the transformer registry.
 *
 * The registry is a security boundary — anything not matched here ends up as
 * IGNORED at the adapter level. These tests pin the "RMA only" scope of the
 * current iteration.
 */
import { describe, it, expect } from "vitest";
import {
  transformers,
  findTransformer,
  findTransformerByInsurerCode,
} from "../../../src/ingestion/transformers/index.js";

describe("transformer registry", () => {
  it("exports the RMA transformer", () => {
    expect(transformers).toHaveLength(1);
    expect(transformers[0]?.insurer_code).toBe("RMA");
  });

  describe("findTransformer(host)", () => {
    it("returns the RMA transformer for rmaassurance.com hosts", () => {
      expect(findTransformer("portail.rmaassurance.com")?.insurer_code).toBe("RMA");
      expect(findTransformer("www.rmaassurance.com")?.insurer_code).toBe("RMA");
      expect(findTransformer("rmaassurance.com")?.insurer_code).toBe("RMA");
    });

    it("normalizes case and whitespace before matching", () => {
      expect(findTransformer("  PORTAIL.rmaassurance.com  ")?.insurer_code).toBe("RMA");
    });

    it("returns undefined for unknown hosts", () => {
      expect(findTransformer("example.com")).toBeUndefined();
      expect(findTransformer("axa.fr")).toBeUndefined();
    });

    it("returns undefined for an empty host (defense in depth)", () => {
      expect(findTransformer("")).toBeUndefined();
      expect(findTransformer("   ")).toBeUndefined();
    });

    it("rejects homograph/suffix attacks", () => {
      // Critical: no transformer should fire for a lookalike host.
      expect(findTransformer("evilrmaassurance.com")).toBeUndefined();
      expect(findTransformer("rmaassurance.com.evil.test")).toBeUndefined();
    });
  });

  describe("findTransformerByInsurerCode(code)", () => {
    it("returns the RMA transformer for insurer_code=RMA", () => {
      expect(findTransformerByInsurerCode("RMA")?.insurer_code).toBe("RMA");
    });

    it("returns undefined for unknown codes", () => {
      expect(findTransformerByInsurerCode("AXA")).toBeUndefined();
      expect(findTransformerByInsurerCode("")).toBeUndefined();
    });
  });
});

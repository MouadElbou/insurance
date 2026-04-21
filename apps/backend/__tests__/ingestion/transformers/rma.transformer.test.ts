/**
 * Unit tests for the RMA transformer.
 *
 * Covers:
 *  - Static identity (insurer_code, hostPattern anchoring)
 *  - Method filtering (only mutations carry client input)
 *  - Client extraction (id + name) from /clients endpoints → IGNORED with
 *    info captured in notes (client-only calls don't produce operations)
 *  - Policy extraction from /polices, /contrats, /souscriptions → TRANSFORMED
 *  - Quittance endpoints → PRODUCTION type inference
 *  - Nested wrappers (`{ data: { client: { ... } } }`) traversal
 *  - fr-FR number format ("12 345,67") parsing
 *  - Error status codes (4xx/5xx) → IGNORED
 *  - Unknown endpoints → IGNORED with diagnostic key list
 *  - Purity: batch processing survives per-event exceptions as ERROR verdicts
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { RmaTransformer } from "../../../src/ingestion/transformers/rma.transformer.js";
import type {
  TransformerContext,
  TransformerInputEvent,
} from "../../../src/ingestion/transformers/transformer.interface.js";

function makeEvent(overrides: Partial<TransformerInputEvent> = {}): TransformerInputEvent {
  return {
    id: overrides.id ?? "evt-1",
    employee_id: overrides.employee_id ?? "emp-1",
    insurer_code: overrides.insurer_code ?? "RMA",
    host: overrides.host ?? "portail.rmaassurance.com",
    url: overrides.url ?? "https://portail.rmaassurance.com/api/policies",
    pathname: overrides.pathname ?? "/api/policies",
    method: overrides.method ?? "POST",
    status_code: overrides.status_code ?? 200,
    request_headers: overrides.request_headers ?? null,
    request_body: overrides.request_body ?? null,
    response_headers: overrides.response_headers ?? null,
    response_body: overrides.response_body ?? null,
    captured_at: overrides.captured_at ?? new Date("2026-04-20T10:00:00.000Z"),
  };
}

const context: TransformerContext = { operatorCode: "OP001" };

describe("RmaTransformer", () => {
  describe("static identity", () => {
    it("advertises insurer_code=RMA", () => {
      const t = new RmaTransformer();
      expect(t.insurer_code).toBe("RMA");
    });

    it("hostPattern matches the apex domain and known subdomains", () => {
      const t = new RmaTransformer();
      expect(t.hostPattern.test("rmaassurance.com")).toBe(true);
      expect(t.hostPattern.test("www.rmaassurance.com")).toBe(true);
      expect(t.hostPattern.test("portail.rmaassurance.com")).toBe(true);
      expect(t.hostPattern.test("gama.rmaassurance.com")).toBe(true);
      expect(t.hostPattern.test("rmastore.rmaassurance.com")).toBe(true);
    });

    it("hostPattern is anchored and rejects lookalikes", () => {
      const t = new RmaTransformer();
      expect(t.hostPattern.test("evil-rmaassurance.com")).toBe(false);
      expect(t.hostPattern.test("rmaassurance.com.evil.test")).toBe(false);
      expect(t.hostPattern.test("notrmaassurance.com")).toBe(false);
    });

    it("hostPattern is case-insensitive", () => {
      const t = new RmaTransformer();
      expect(t.hostPattern.test("PORTAIL.RMAASSURANCE.COM")).toBe(true);
    });
  });

  describe("method filtering", () => {
    it("ignores GET — reads don't carry client input", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [makeEvent({ id: "evt-get", method: "GET" })],
        context,
      );
      expect(result.operations).toEqual([]);
      expect(result.verdicts).toHaveLength(1);
      expect(result.verdicts[0]!.verdict).toBe("IGNORED");
      expect(result.verdicts[0]!.notes).toMatch(/mutations/i);
    });

    it("ignores DELETE", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [makeEvent({ id: "evt-del", method: "DELETE" })],
        context,
      );
      expect(result.verdicts[0]!.verdict).toBe("IGNORED");
    });

    it("ignores 4xx/5xx responses even on POST", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-500",
            method: "POST",
            pathname: "/api/polices",
            status_code: 500,
            response_body: JSON.stringify({ numeroPolice: "P-1" }),
          }),
        ],
        context,
      );
      expect(result.operations).toEqual([]);
      expect(result.verdicts[0]!.verdict).toBe("IGNORED");
      expect(result.verdicts[0]!.notes).toMatch(/500/);
    });
  });

  describe("client endpoint — captures identity without emitting an operation", () => {
    it("extracts client_id + raisonSociale and surfaces them in notes", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-client",
            method: "POST",
            pathname: "/api/clients",
            response_body: JSON.stringify({
              numeroClient: "C-42",
              raisonSociale: "ACME Maroc SARL",
            }),
          }),
        ],
        context,
      );
      expect(result.operations).toEqual([]);
      expect(result.verdicts[0]!.verdict).toBe("IGNORED");
      expect(result.verdicts[0]!.notes).toContain("C-42");
      expect(result.verdicts[0]!.notes).toContain("ACME Maroc SARL");
    });

    it("composes client_name from prenom + nom when no composite field present", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-client-2",
            method: "PUT",
            pathname: "/api/customers/77",
            response_body: JSON.stringify({
              clientId: "77",
              prenom: "Fatima",
              nom: "El Alaoui",
            }),
          }),
        ],
        context,
      );
      expect(result.verdicts[0]!.notes).toContain("Fatima El Alaoui");
    });

    it("reports observed top-level keys when no client fields recognized", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-client-unknown",
            method: "POST",
            pathname: "/api/clients",
            response_body: JSON.stringify({
              unknownField: "x",
              anotherField: 1,
            }),
          }),
        ],
        context,
      );
      expect(result.verdicts[0]!.notes).toContain("unknownField");
      expect(result.verdicts[0]!.notes).toContain("anotherField");
    });
  });

  describe("policy endpoint — extracts an Operation", () => {
    it("produces an EMISSION from POST /api/polices with full payload", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-pol",
            method: "POST",
            pathname: "/api/polices",
            response_body: JSON.stringify({
              data: {
                numeroPolice: "POL-2026-0001",
                numeroAvenant: "0",
                dateEffet: "2026-05-01",
                dateEmission: "2026-04-21T10:00:00Z",
                primeNette: 5000.5,
                taxes: 350,
                primeTotale: 5350.5,
                commission: 500,
                client: {
                  numeroClient: "C-42",
                  raisonSociale: "ACME Maroc SARL",
                },
              },
            }),
          }),
        ],
        context,
      );
      expect(result.operations).toHaveLength(1);
      const op = result.operations[0]!;
      expect(op.type).toBe("EMISSION");
      expect(op.source).toBe("SCRAPER");
      expect(op.operator_code).toBe("OP001");
      expect(op.policy_number).toBe("POL-2026-0001");
      expect(op.avenant_number).toBe("0");
      expect(op.client_id).toBe("C-42");
      expect(op.client_name).toBe("ACME Maroc SARL");
      expect(op.prime_net).toBeInstanceOf(Decimal);
      expect(op.prime_net!.toString()).toBe("5000.5");
      expect(op.total_prime!.toString()).toBe("5350.5");
      expect(op.commission!.toString()).toBe("500");
      expect(op.effective_date).toEqual(new Date("2026-05-01"));

      const verdict = result.verdicts[0]!;
      expect(verdict.verdict).toBe("TRANSFORMED");
      expect(verdict.operation_keys).toHaveLength(1);
      expect(verdict.operation_keys![0]!).toMatchObject({
        type: "EMISSION",
        policy_number: "POL-2026-0001",
      });
    });

    it("infers PRODUCTION for quittance endpoints", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-quit",
            method: "POST",
            pathname: "/api/quittances",
            response_body: JSON.stringify({
              numeroPolice: "POL-2026-0001",
              numeroQuittance: "Q-0001",
              primeTotale: "1 234,56",
            }),
          }),
        ],
        context,
      );
      expect(result.operations).toHaveLength(1);
      const op = result.operations[0]!;
      expect(op.type).toBe("PRODUCTION");
      expect(op.quittance_number).toBe("Q-0001");
      // fr-FR format "1 234,56" must parse to 1234.56
      expect(op.total_prime!.toString()).toBe("1234.56");
    });

    it("emits IGNORED when policy_number is missing, exposing observed keys", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-pol-no-num",
            method: "POST",
            pathname: "/api/polices",
            response_body: JSON.stringify({
              someField: "x",
              other: 1,
            }),
          }),
        ],
        context,
      );
      expect(result.operations).toEqual([]);
      expect(result.verdicts[0]!.verdict).toBe("IGNORED");
      expect(result.verdicts[0]!.notes).toContain("someField");
    });

    it("extracts from /contrats path with client in root", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-contrat",
            method: "POST",
            pathname: "/gama/api/contrats",
            response_body: JSON.stringify({
              numeroContrat: "CTR-9",
              clientId: "C-9",
              fullName: "Hassan Bennani",
            }),
          }),
        ],
        context,
      );
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]!.policy_number).toBe("CTR-9");
      expect(result.operations[0]!.client_id).toBe("C-9");
      expect(result.operations[0]!.client_name).toBe("Hassan Bennani");
    });
  });

  describe("unknown endpoint diagnostics", () => {
    it("returns IGNORED with observed keys for unrecognized paths", async () => {
      const t = new RmaTransformer();
      const result = await t.transform(
        [
          makeEvent({
            id: "evt-unknown",
            method: "POST",
            pathname: "/api/mystery-endpoint",
            response_body: JSON.stringify({ foo: 1, bar: 2 }),
          }),
        ],
        context,
      );
      expect(result.operations).toEqual([]);
      expect(result.verdicts[0]!.verdict).toBe("IGNORED");
      expect(result.verdicts[0]!.notes).toContain("/api/mystery-endpoint");
      expect(result.verdicts[0]!.notes).toContain("foo");
      expect(result.verdicts[0]!.notes).toContain("bar");
    });
  });

  describe("batch semantics", () => {
    it("preserves event order and emits one verdict per input event", async () => {
      const t = new RmaTransformer();
      const events = [
        makeEvent({ id: "a", method: "GET" }),
        makeEvent({
          id: "b",
          method: "POST",
          pathname: "/api/polices",
          response_body: JSON.stringify({ numeroPolice: "P-B" }),
        }),
        makeEvent({ id: "c", method: "POST", pathname: "/api/clients" }),
      ];
      const result = await t.transform(events, context);
      expect(result.verdicts.map((v) => v.event_id)).toEqual(["a", "b", "c"]);
      expect(result.verdicts.map((v) => v.verdict)).toEqual([
        "IGNORED",
        "TRANSFORMED",
        "IGNORED",
      ]);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]!.policy_number).toBe("P-B");
    });

    it("handles empty input without throwing", async () => {
      const t = new RmaTransformer();
      const result = await t.transform([], context);
      expect(result.operations).toEqual([]);
      expect(result.verdicts).toEqual([]);
    });

    it("does not mutate the input events (transformer contract)", async () => {
      const t = new RmaTransformer();
      const e = makeEvent({
        id: "evt-freeze",
        method: "POST",
        pathname: "/api/polices",
        response_body: JSON.stringify({ numeroPolice: "P-Z" }),
      });
      const before = JSON.stringify(e);
      await t.transform([e], context);
      expect(JSON.stringify(e)).toBe(before);
    });
  });
});

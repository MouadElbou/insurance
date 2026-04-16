import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import ExcelJS from "exceljs";
import { createRequire } from "module";

// Mock the logger to prevent config.ts import
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ExcelAdapter } from "../../src/ingestion/adapters/excel.adapter.js";

const EMISSION_SHEET_NAME = "EtatJournalierEmissionsQuittance"; // 33 chars

/**
 * ExcelJS truncates worksheet names to 31 characters. The real insurance system
 * produces xlsx files with the full 33-char emission sheet name. We work around
 * the ExcelJS limitation by:
 * 1. Creating the worksheet with a short placeholder name
 * 2. Writing to xlsx buffer
 * 3. Using JSZip (bundled with exceljs) to patch the sheet name in the xml
 * 4. Monkey-patching the Worksheet.name setter so ExcelJS can load the full name
 */

// Resolve JSZip from the exceljs dependency tree (it is a direct dep of exceljs)
const require = createRequire(import.meta.url);
let JSZip: any;
try {
  JSZip = require("jszip");
} catch {
  // Fallback: find it in the pnpm store
  const { readdirSync } = await import("fs");
  const pnpmBase = "D:/UpWork/insurance/node_modules/.pnpm";
  const jszipDir = readdirSync(pnpmBase).find((d: string) => d.startsWith("jszip@"));
  if (jszipDir) {
    JSZip = require(`${pnpmBase}/${jszipDir}/node_modules/jszip`);
  }
}

// Save original Worksheet.name descriptor so we can monkey-patch and restore
const sampleWb = new ExcelJS.Workbook();
const sampleSheet = sampleWb.addWorksheet("_probe");
const wsProto = Object.getPrototypeOf(sampleSheet);
const origNameDescriptor = Object.getOwnPropertyDescriptor(wsProto, "name")!;

/**
 * Temporarily bypass ExcelJS 31-char name validation during load.
 */
function patchNameSetter() {
  Object.defineProperty(wsProto, "name", {
    get: origNameDescriptor.get,
    set: function (value: string) {
      (this as any)._name = value;
    },
    configurable: true,
  });
}

function restoreNameSetter() {
  Object.defineProperty(wsProto, "name", origNameDescriptor);
}

/**
 * Patch sheet names in an xlsx buffer using JSZip.
 * Replaces occurrences of placeholder names with the full emission sheet name.
 */
async function patchSheetName(buf: Buffer, from: string, to: string): Promise<Buffer> {
  if (!JSZip) throw new Error("JSZip not available — cannot patch sheet names");
  const zip = await JSZip.loadAsync(buf);
  const wbXml: string = await zip.file("xl/workbook.xml").async("string");
  const fixedXml = wbXml.replace(from, to);
  zip.file("xl/workbook.xml", fixedXml);
  return Buffer.from(await zip.generateAsync({ type: "arraybuffer" }));
}

afterAll(() => {
  restoreNameSetter();
});

/**
 * Build a minimal Excel workbook buffer with production and/or emission sheets
 * for use in tests.
 */
async function buildTestWorkbook(options: {
  production?: {
    headers: Record<string, string>;
    rows: unknown[][];
  };
  emission?: {
    headers: Record<string, string>;
    rows: unknown[][];
  };
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const EMISSION_PLACEHOLDER = "EmissionPlaceholder";

  if (options.production) {
    const sheet = workbook.addWorksheet("EtatJournalierProduction");
    // Headers go in row 9
    const headerRow = sheet.getRow(9);
    for (const [name, _] of Object.entries(options.production.headers)) {
      const colIdx = Object.keys(options.production.headers).indexOf(name) + 1;
      headerRow.getCell(colIdx).value = options.production.headers[name];
    }
    headerRow.commit();

    // Data rows start at row 10
    for (let i = 0; i < options.production.rows.length; i++) {
      const dataRow = sheet.getRow(10 + i);
      const values = options.production.rows[i];
      for (let j = 0; j < values.length; j++) {
        dataRow.getCell(j + 1).value = values[j] as ExcelJS.CellValue;
      }
      dataRow.commit();
    }
  }

  if (options.emission) {
    // Use a short placeholder name that ExcelJS won't truncate
    const sheet = workbook.addWorksheet(EMISSION_PLACEHOLDER);
    const headerRow = sheet.getRow(9);
    const headerKeys = Object.keys(options.emission.headers);
    for (let k = 0; k < headerKeys.length; k++) {
      headerRow.getCell(k + 1).value = options.emission.headers[headerKeys[k]];
    }
    headerRow.commit();

    for (let i = 0; i < options.emission.rows.length; i++) {
      const dataRow = sheet.getRow(10 + i);
      const values = options.emission.rows[i];
      for (let j = 0; j < values.length; j++) {
        dataRow.getCell(j + 1).value = values[j] as ExcelJS.CellValue;
      }
      dataRow.commit();
    }
  }

  let buf = Buffer.from(await workbook.xlsx.writeBuffer());

  // If emission sheet was created, patch the placeholder name in the xlsx xml
  if (options.emission && JSZip) {
    buf = await patchSheetName(buf, EMISSION_PLACEHOLDER, EMISSION_SHEET_NAME);
  }

  return buf;
}

describe("ExcelAdapter", () => {
  let adapter: ExcelAdapter;

  beforeEach(() => {
    adapter = new ExcelAdapter();
    // Patch the name setter so ExcelJS can load sheets with names > 31 chars
    patchNameSetter();
  });

  it("should have the name 'excel'", () => {
    expect(adapter.name).toBe("excel");
  });

  describe("parseProductionSheet", () => {
    it("should parse a production sheet with standard headers", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            avenant: "N Avenant",
            client: "Client",
            status: "Etat Police",
            event: "Evenement",
            dateEffet: "Date Effet",
            attestation: "N Attestation",
            primeNet: "Prime Net",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", "AV-01", "123 John Doe", "ACTIVE", "CREATION", "15/01/2025", "ATT-001", 1500.50, "int46442"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("PRODUCTION");
      expect(results[0].source).toBe("EXCEL");
      expect(results[0].policy_number).toBe("POL-001");
      expect(results[0].avenant_number).toBe("AV-01");
      expect(results[0].client_id).toBe("123");
      expect(results[0].client_name).toBe("John Doe");
      expect(results[0].policy_status).toBe("ACTIVE");
      expect(results[0].event_type).toBe("CREATION");
      expect(results[0].operator_code).toBe("int46442");
    });

    it("should skip rows without a policy number", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
          },
          rows: [
            [null, "int12345"],  // no policy number
            ["POL-001", "int12345"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].policy_number).toBe("POL-001");
    });

    it("should skip rows without an operator code", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", null],     // no intermediaire
            ["POL-002", "int12345"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].policy_number).toBe("POL-002");
    });

    it("should skip TOTAL rows", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
            primeNet: "Prime Net",
          },
          rows: [
            ["POL-001", "int12345", 1000],
            ["TOTAL", null, 1000],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
    });

    it("should extract operator code from parenthetical format", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", "Ahmed Benali (int46442)"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].operator_code).toBe("int46442");
    });

    it("should parse client cell with numeric ID prefix", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            client: "Client",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", "456 Some Company", "int12345"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results[0].client_id).toBe("456");
      expect(results[0].client_name).toBe("Some Company");
    });

    it("should handle client cell without numeric prefix", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            client: "Client",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", "Some Client Name", "int12345"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results[0].client_id).toBeUndefined();
      expect(results[0].client_name).toBe("Some Client Name");
    });
  });

  describe("parseEmissionSheet", () => {
    it("should parse an emission sheet with standard headers", async () => {
      const buffer = await buildTestWorkbook({
        emission: {
          headers: {
            policy: "N Police",
            quittance: "N Quittance",
            client: "Client",
            emissionDate: "Date Emission",
            dateEffet: "Date Effet",
            primeNet: "Prime Net",
            impot: "Impot",
            taxePara: "Taxe Para",
            primeTotale: "Prime Totale",
            commission: "Commission",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-100", "QT-001", "789 Emission Client", "10/02/2025", "01/03/2025", 2000, 200, 50, 2250, 400, "int99999"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("EMISSION");
      expect(results[0].source).toBe("EXCEL");
      expect(results[0].policy_number).toBe("POL-100");
      expect(results[0].quittance_number).toBe("QT-001");
      expect(results[0].client_id).toBe("789");
      expect(results[0].client_name).toBe("Emission Client");
      expect(results[0].operator_code).toBe("int99999");
    });

    it("should skip TOTAL rows in emission sheet", async () => {
      const buffer = await buildTestWorkbook({
        emission: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", "int12345"],
            ["TOTAL GENERAL", null],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(1);
    });
  });

  describe("both sheets", () => {
    it("should parse both production and emission sheets from the same workbook", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["PROD-001", "int11111"],
            ["PROD-002", "int11111"],
          ],
        },
        emission: {
          headers: {
            policy: "N Police",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["EMIT-001", "int22222"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(3);
      const types = results.map((r) => r.type);
      expect(types.filter((t) => t === "PRODUCTION")).toHaveLength(2);
      expect(types.filter((t) => t === "EMISSION")).toHaveLength(1);
    });

    it("should return empty array when no recognized sheets exist", async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Random Sheet");
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const results = await adapter.parse(buffer);

      expect(results).toEqual([]);
    });
  });

  describe("multiple data rows", () => {
    it("should parse multiple production rows correctly", async () => {
      const buffer = await buildTestWorkbook({
        production: {
          headers: {
            policy: "N Police",
            client: "Client",
            primeNet: "Prime Net",
            intermediaire: "Intermediaire",
          },
          rows: [
            ["POL-001", "100 Client A", 1000, "int11111"],
            ["POL-002", "200 Client B", 2000, "int22222"],
            ["POL-003", "300 Client C", 3000, "int33333"],
          ],
        },
      });

      const results = await adapter.parse(buffer);

      expect(results).toHaveLength(3);
      expect(results[0].policy_number).toBe("POL-001");
      expect(results[1].policy_number).toBe("POL-002");
      expect(results[2].policy_number).toBe("POL-003");
    });
  });
});

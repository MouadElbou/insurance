import ExcelJS from "exceljs";
import { Decimal } from "@prisma/client/runtime/library";
import type { IngestionAdapter, ParsedOperation } from "../adapter.interface.js";
import { parseExcelDate, parseDecimalValue } from "../../utils/date.js";
import { logger } from "../../utils/logger.js";

/**
 * Parse a client cell value: "123 CLIENT NAME" -> { client_id: "123", client_name: "CLIENT NAME" }
 * If no space is found, the whole string becomes client_name.
 */
function parseClientCell(value: unknown): { client_id?: string; client_name?: string } {
  if (value === null || value === undefined) return {};
  const str = String(value).trim();
  if (!str) return {};

  const spaceIdx = str.indexOf(" ");
  if (spaceIdx === -1) {
    return { client_name: str };
  }

  const potentialId = str.substring(0, spaceIdx);
  // Only treat as client_id if it looks numeric
  if (/^\d+$/.test(potentialId)) {
    return {
      client_id: potentialId,
      client_name: str.substring(spaceIdx + 1).trim(),
    };
  }

  return { client_name: str };
}

/**
 * Extract operator code from the intermediary column.
 * May contain values like "int46442" directly, or "Ahmed Benali (int46442)",
 * or just a code. We extract anything matching /int\d+/i pattern.
 */
function extractOperatorCode(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str) return "";

  // Try to find pattern like "int46442"
  const match = str.match(/\b(int\d+)\b/i);
  if (match) return match[1].toLowerCase();

  // If it's already just a code-like string, return it
  return str;
}

/**
 * Resolve a cell value (exceljs may return richText objects, shared strings, etc.)
 */
function cellValue(cell: ExcelJS.Cell): unknown {
  const val = cell.value;
  if (val === null || val === undefined) return undefined;

  // Handle richText
  if (typeof val === "object" && "richText" in val) {
    return (val as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join("");
  }

  // Handle formula result
  if (typeof val === "object" && "result" in val) {
    return (val as ExcelJS.CellFormulaValue).result;
  }

  // Handle hyperlink
  if (typeof val === "object" && "text" in val) {
    return (val as ExcelJS.CellHyperlinkValue).text;
  }

  return val;
}

function toDecimal(value: unknown): Decimal | undefined {
  const num = parseDecimalValue(value);
  if (num === undefined) return undefined;
  return new Decimal(num);
}

/**
 * Map header names (case-insensitive, trimmed) to column indices.
 */
function buildHeaderMap(row: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = cellValue(cell);
    if (val !== undefined && val !== null) {
      const key = String(val).trim().toLowerCase();
      if (key) map.set(key, colNumber);
    }
  });
  return map;
}

function getCellVal(row: ExcelJS.Row, colIdx: number | undefined): unknown {
  if (colIdx === undefined) return undefined;
  return cellValue(row.getCell(colIdx));
}

/**
 * Check if any cell in the row contains "TOTAL" (case-insensitive) — these are summary rows.
 */
function isTotalRow(row: ExcelJS.Row): boolean {
  let isTotal = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const val = cellValue(cell);
    if (typeof val === "string" && val.toUpperCase().includes("TOTAL")) {
      isTotal = true;
    }
  });
  return isTotal;
}

export class ExcelAdapter implements IngestionAdapter {
  name = "excel";

  async parse(input: unknown): Promise<ParsedOperation[]> {
    const buffer = input as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const operations: ParsedOperation[] = [];

    // Process PRODUCTION sheet
    const prodSheet = workbook.getWorksheet("EtatJournalierProduction");
    if (prodSheet) {
      const parsed = this.parseProductionSheet(prodSheet);
      operations.push(...parsed);
    } else {
      logger.warn("Sheet 'EtatJournalierProduction' not found in workbook");
    }

    // Process EMISSION sheet
    const emissionSheet = workbook.getWorksheet("EtatJournalierEmissionsQuittance");
    if (emissionSheet) {
      const parsed = this.parseEmissionSheet(emissionSheet);
      operations.push(...parsed);
    } else {
      logger.warn("Sheet 'EtatJournalierEmissionsQuittance' not found in workbook");
    }

    logger.info(
      { totalParsed: operations.length },
      "Excel parsing complete",
    );
    return operations;
  }

  private parseProductionSheet(sheet: ExcelJS.Worksheet): ParsedOperation[] {
    const operations: ParsedOperation[] = [];

    // Header row is row 9 (1-indexed)
    const headerRow = sheet.getRow(9);
    const headers = buildHeaderMap(headerRow);

    // Find column indices by header name (case-insensitive)
    const colPolicy = headers.get("n police") ?? headers.get("n° police") ?? headers.get("n police");
    const colAvenant = headers.get("n avenant") ?? headers.get("n° avenant");
    const colClient = headers.get("client");
    const colStatus = headers.get("etat police");
    const colEvent = headers.get("evenement");
    const colDateEffet = headers.get("date effet");
    const colAttestation = headers.get("n attestation") ?? headers.get("n° attestation");
    const colPrimeNet = headers.get("prime net");
    const colIntermediary =
      headers.get("intermediaire") ?? headers.get("code intermediaire");

    // Data starts at row 10
    const rowCount = sheet.rowCount;
    for (let i = 10; i <= rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      if (isTotalRow(row)) continue;

      const policyNumber = getCellVal(row, colPolicy);
      if (!policyNumber) continue; // Skip rows without policy number

      const client = parseClientCell(getCellVal(row, colClient));
      const operatorCode = extractOperatorCode(getCellVal(row, colIntermediary));
      if (!operatorCode) continue; // Skip rows without operator code

      const op: ParsedOperation = {
        type: "PRODUCTION",
        source: "EXCEL",
        operator_code: operatorCode,
        policy_number: String(policyNumber).trim(),
        avenant_number: getCellVal(row, colAvenant)
          ? String(getCellVal(row, colAvenant)).trim()
          : undefined,
        client_id: client.client_id,
        client_name: client.client_name,
        policy_status: getCellVal(row, colStatus)
          ? String(getCellVal(row, colStatus)).trim()
          : undefined,
        event_type: getCellVal(row, colEvent)
          ? String(getCellVal(row, colEvent)).trim()
          : undefined,
        effective_date: parseExcelDate(getCellVal(row, colDateEffet)),
        attestation_number: getCellVal(row, colAttestation)
          ? String(getCellVal(row, colAttestation)).trim()
          : undefined,
        prime_net: toDecimal(getCellVal(row, colPrimeNet)),
      };

      operations.push(op);
    }

    logger.info(
      { sheet: "EtatJournalierProduction", count: operations.length },
      "Production sheet parsed",
    );
    return operations;
  }

  private parseEmissionSheet(sheet: ExcelJS.Worksheet): ParsedOperation[] {
    const operations: ParsedOperation[] = [];

    // Header row is row 9 (1-indexed)
    const headerRow = sheet.getRow(9);
    const headers = buildHeaderMap(headerRow);

    const colPolicy = headers.get("n police") ?? headers.get("n° police");
    const colQuittance = headers.get("n quittance") ?? headers.get("n° quittance");
    const colClient = headers.get("client");
    const colEmissionDate =
      headers.get("date emission quittance") ?? headers.get("date emission");
    const colDateEffet = headers.get("date effet");
    const colPrimeNet = headers.get("prime net");
    const colTax = headers.get("impot");
    const colParafiscal = headers.get("taxe para") ?? headers.get("taxe parafiscale");
    const colTotalPrime = headers.get("prime totale");
    const colCommission = headers.get("commission");
    const colIntermediary =
      headers.get("intermediaire") ?? headers.get("code intermediaire");

    const rowCount = sheet.rowCount;
    for (let i = 10; i <= rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;
      if (isTotalRow(row)) continue;

      const policyNumber = getCellVal(row, colPolicy);
      if (!policyNumber) continue;

      const client = parseClientCell(getCellVal(row, colClient));
      const operatorCode = extractOperatorCode(getCellVal(row, colIntermediary));
      if (!operatorCode) continue;

      const op: ParsedOperation = {
        type: "EMISSION",
        source: "EXCEL",
        operator_code: operatorCode,
        policy_number: String(policyNumber).trim(),
        quittance_number: getCellVal(row, colQuittance)
          ? String(getCellVal(row, colQuittance)).trim()
          : undefined,
        client_id: client.client_id,
        client_name: client.client_name,
        emission_date: parseExcelDate(getCellVal(row, colEmissionDate)),
        effective_date: parseExcelDate(getCellVal(row, colDateEffet)),
        prime_net: toDecimal(getCellVal(row, colPrimeNet)),
        tax_amount: toDecimal(getCellVal(row, colTax)),
        parafiscal_tax: toDecimal(getCellVal(row, colParafiscal)),
        total_prime: toDecimal(getCellVal(row, colTotalPrime)),
        commission: toDecimal(getCellVal(row, colCommission)),
      };

      operations.push(op);
    }

    logger.info(
      { sheet: "EtatJournalierEmissionsQuittance", count: operations.length },
      "Emission sheet parsed",
    );
    return operations;
  }
}

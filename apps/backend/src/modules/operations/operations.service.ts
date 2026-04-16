import type { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import ExcelJS from "exceljs";
import type {
  Operation,
  OperationFilters,
  OperationStats,
  PaginatedResponse,
  CreateOperationRequest,
  Role,
} from "@insurance/shared";
import { sanitizeOptional } from "../../utils/sanitize.js";

function toOperationResponse(
  row: Prisma.OperationGetPayload<{ include: { employee: { select: { full_name: true } } } }>,
): Operation {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    client_id: row.client_id,
    client_name: row.client_name,
    policy_number: row.policy_number,
    avenant_number: row.avenant_number,
    quittance_number: row.quittance_number,
    attestation_number: row.attestation_number,
    policy_status: row.policy_status,
    event_type: row.event_type,
    emission_date: row.emission_date?.toISOString() ?? null,
    effective_date: row.effective_date?.toISOString() ?? null,
    prime_net: row.prime_net?.toString() ?? null,
    tax_amount: row.tax_amount?.toString() ?? null,
    parafiscal_tax: row.parafiscal_tax?.toString() ?? null,
    total_prime: row.total_prime?.toString() ?? null,
    commission: row.commission?.toString() ?? null,
    employee_id: row.employee_id,
    employee_name: row.employee?.full_name,
    upload_id: row.upload_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function buildWhereClause(
  filters: OperationFilters,
  userId: string,
  role: Role,
): Prisma.OperationWhereInput {
  const where: Prisma.OperationWhereInput = {};

  // EMPLOYEE role auto-filters to own operations
  if (role === "EMPLOYEE") {
    where.employee_id = userId;
  } else if (filters.employee_id) {
    where.employee_id = filters.employee_id;
  }

  if (filters.type) where.type = filters.type;
  if (filters.source) where.source = filters.source;

  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) {
      where.created_at.gte = new Date(filters.date_from);
    }
    if (filters.date_to) {
      where.created_at.lte = new Date(filters.date_to);
    }
  }

  if (filters.search) {
    const search = filters.search;
    where.OR = [
      { policy_number: { contains: search, mode: "insensitive" } },
      { client_name: { contains: search, mode: "insensitive" } },
      { client_id: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function list(
  prisma: PrismaClient,
  filters: OperationFilters,
  userId: string,
  role: Role,
): Promise<PaginatedResponse<Operation>> {
  const page = filters.page ?? 1;
  const perPage = filters.per_page ?? 25;
  const sortBy = filters.sort_by ?? "created_at";
  const sortOrder = filters.sort_order ?? "desc";

  const where = buildWhereClause(filters, userId, role);

  const [rows, totalItems] = await Promise.all([
    prisma.operation.findMany({
      where,
      include: { employee: { select: { full_name: true } } },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.operation.count({ where }),
  ]);

  return {
    items: rows.map(toOperationResponse),
    pagination: {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: Math.ceil(totalItems / perPage),
    },
  };
}

export async function getById(
  prisma: PrismaClient,
  id: string,
  userId: string,
  role: Role,
): Promise<Operation> {
  const row = await prisma.operation.findUnique({
    where: { id },
    include: { employee: { select: { full_name: true } } },
  });

  if (!row) {
    throw Object.assign(new Error("Operation introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  // EMPLOYEE can only view own operations
  if (role === "EMPLOYEE" && row.employee_id !== userId) {
    throw Object.assign(
      new Error("Vous ne pouvez consulter que vos propres operations."),
      { statusCode: 403, code: "AUTH_INSUFFICIENT_ROLE" },
    );
  }

  return toOperationResponse(row);
}

export async function create(
  prisma: PrismaClient,
  data: CreateOperationRequest,
  employeeId: string,
): Promise<Operation> {
  const row = await prisma.operation.create({
    data: {
      type: data.type,
      source: "MANUAL",
      client_id: sanitizeOptional(data.client_id) ?? null,
      client_name: sanitizeOptional(data.client_name) ?? null,
      policy_number: data.policy_number,
      avenant_number: data.avenant_number ?? null,
      quittance_number: data.quittance_number ?? null,
      attestation_number: data.attestation_number ?? null,
      policy_status: sanitizeOptional(data.policy_status) ?? null,
      event_type: sanitizeOptional(data.event_type) ?? null,
      emission_date: data.emission_date ? new Date(data.emission_date) : null,
      effective_date: data.effective_date ? new Date(data.effective_date) : null,
      prime_net: data.prime_net ? new Decimal(data.prime_net) : null,
      tax_amount: data.tax_amount ? new Decimal(data.tax_amount) : null,
      parafiscal_tax: data.parafiscal_tax ? new Decimal(data.parafiscal_tax) : null,
      total_prime: data.total_prime ? new Decimal(data.total_prime) : null,
      commission: data.commission ? new Decimal(data.commission) : null,
      employee_id: employeeId,
    },
    include: { employee: { select: { full_name: true } } },
  });

  return toOperationResponse(row);
}

export async function getStats(
  prisma: PrismaClient,
  filters: Pick<OperationFilters, "employee_id" | "date_from" | "date_to">,
): Promise<OperationStats> {
  const where: Prisma.OperationWhereInput = {};
  if (filters.employee_id) where.employee_id = filters.employee_id;
  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) where.created_at.gte = new Date(filters.date_from);
    if (filters.date_to) where.created_at.lte = new Date(filters.date_to);
  }

  const [
    aggregation,
    policyCount,
    productionCount,
    emissionCount,
    excelCount,
    manualCount,
    scraperCount,
  ] = await Promise.all([
    prisma.operation.aggregate({
      where,
      _count: { id: true },
      _sum: { prime_net: true, commission: true },
    }),
    prisma.operation.findMany({
      where,
      select: { policy_number: true },
      distinct: ["policy_number"],
    }),
    prisma.operation.count({ where: { ...where, type: "PRODUCTION" } }),
    prisma.operation.count({ where: { ...where, type: "EMISSION" } }),
    prisma.operation.count({ where: { ...where, source: "EXCEL" } }),
    prisma.operation.count({ where: { ...where, source: "MANUAL" } }),
    prisma.operation.count({ where: { ...where, source: "SCRAPER" } }),
  ]);

  return {
    total_operations: aggregation._count.id,
    total_prime_net: aggregation._sum.prime_net?.toString() ?? "0",
    total_commissions: aggregation._sum.commission?.toString() ?? "0",
    total_policies: policyCount.length,
    by_type: {
      PRODUCTION: productionCount,
      EMISSION: emissionCount,
    },
    by_source: {
      EXCEL: excelCount,
      MANUAL: manualCount,
      SCRAPER: scraperCount,
    },
  };
}

export async function exportToExcel(
  prisma: PrismaClient,
  filters: Pick<OperationFilters, "employee_id" | "type" | "source" | "date_from" | "date_to">,
): Promise<Buffer> {
  const where: Prisma.OperationWhereInput = {};
  if (filters.employee_id) where.employee_id = filters.employee_id;
  if (filters.type) where.type = filters.type;
  if (filters.source) where.source = filters.source;
  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) where.created_at.gte = new Date(filters.date_from);
    if (filters.date_to) where.created_at.lte = new Date(filters.date_to);
  }

  const rows = await prisma.operation.findMany({
    where,
    include: { employee: { select: { full_name: true } } },
    orderBy: { created_at: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Operations");

  sheet.columns = [
    { header: "Type", key: "type", width: 15 },
    { header: "Client", key: "client_name", width: 30 },
    { header: "N\u00b0 Police", key: "policy_number", width: 20 },
    { header: "N\u00b0 Avenant", key: "avenant_number", width: 15 },
    { header: "N\u00b0 Quittance", key: "quittance_number", width: 15 },
    { header: "Date Effet", key: "effective_date", width: 15 },
    { header: "Prime Net", key: "prime_net", width: 15 },
    { header: "Commission", key: "commission", width: 15 },
    { header: "Employ\u00e9", key: "employee_name", width: 25 },
    { header: "Source", key: "source", width: 12 },
    { header: "Date", key: "created_at", width: 15 },
  ];

  for (const row of rows) {
    sheet.addRow({
      type: row.type,
      client_name: row.client_name ?? "",
      policy_number: row.policy_number,
      avenant_number: row.avenant_number ?? "",
      quittance_number: row.quittance_number ?? "",
      effective_date: row.effective_date
        ? row.effective_date.toLocaleDateString("fr-FR")
        : "",
      prime_net: row.prime_net ? parseFloat(row.prime_net.toString()) : "",
      commission: row.commission ? parseFloat(row.commission.toString()) : "",
      employee_name: row.employee?.full_name ?? "",
      source: row.source,
      created_at: row.created_at.toLocaleDateString("fr-FR"),
    });
  }

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

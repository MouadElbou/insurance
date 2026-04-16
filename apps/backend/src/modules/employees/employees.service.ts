import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "@insurance/shared";
import { hashPassword } from "../../utils/password.js";

// Fields to exclude from all employee queries — never expose password_hash
const employeeSelect = {
  id: true,
  email: true,
  full_name: true,
  operator_code: true,
  role: true,
  is_active: true,
  last_heartbeat: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.EmployeeSelect;

function toEmployeeResponse(row: Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>): Employee {
  return {
    ...row,
    last_heartbeat: row.last_heartbeat?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

interface ListFilters {
  is_active?: boolean;
  role?: "MANAGER" | "EMPLOYEE";
  search?: string;
  page?: number;
  per_page?: number;
}

interface PaginatedEmployees {
  items: Employee[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}

export async function list(
  prisma: PrismaClient,
  filters: ListFilters = {},
): Promise<PaginatedEmployees> {
  const page = filters.page ?? 1;
  const perPage = filters.per_page ?? 25;
  const where: Prisma.EmployeeWhereInput = {};

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.search) {
    const search = filters.search;
    where.OR = [
      { full_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { operator_code: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, totalItems] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: { full_name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    items: rows.map(toEmployeeResponse),
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
): Promise<Employee> {
  const row = await prisma.employee.findUnique({
    where: { id },
    select: employeeSelect,
  });

  if (!row) {
    throw Object.assign(new Error("Employe introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  return toEmployeeResponse(row);
}

export async function create(
  prisma: PrismaClient,
  data: CreateEmployeeRequest,
): Promise<Employee> {
  const passwordHash = await hashPassword(data.password);

  const row = await prisma.employee.create({
    data: {
      email: data.email,
      password_hash: passwordHash,
      full_name: data.full_name,
      operator_code: data.operator_code,
      role: data.role,
    },
    select: employeeSelect,
  });

  return toEmployeeResponse(row);
}

export async function update(
  prisma: PrismaClient,
  id: string,
  data: UpdateEmployeeRequest,
): Promise<Employee> {
  // Verify employee exists
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error("Employe introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  const updateData: Prisma.EmployeeUpdateInput = {};
  if (data.email !== undefined) updateData.email = data.email;
  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.operator_code !== undefined) updateData.operator_code = data.operator_code;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  if (data.password !== undefined) {
    updateData.password_hash = await hashPassword(data.password);
  }

  const row = await prisma.employee.update({
    where: { id },
    data: updateData,
    select: employeeSelect,
  });

  return toEmployeeResponse(row);
}

export async function remove(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error("Employe introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  // Soft delete: deactivate instead of deleting to preserve operation history
  await prisma.employee.update({
    where: { id },
    data: { is_active: false },
  });
}

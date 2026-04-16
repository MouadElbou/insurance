import type { PrismaClient } from "@prisma/client";
import type {
  KpiData,
  ActivityItem,
  EmployeePresence,
  PresenceStatus,
} from "@insurance/shared";

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday as start of week (French convention)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface PeriodAggregation {
  total_prime: string;
  total_commission: string;
  operations_count: number;
  policies_count: number;
}

async function aggregateForPeriod(
  prisma: PrismaClient,
  from: Date,
): Promise<PeriodAggregation> {
  const where = { created_at: { gte: from } };

  const [agg, policies] = await Promise.all([
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
  ]);

  return {
    total_prime: agg._sum.prime_net?.toString() ?? "0",
    total_commission: agg._sum.commission?.toString() ?? "0",
    operations_count: agg._count.id,
    policies_count: policies.length,
  };
}

export async function getKpis(prisma: PrismaClient): Promise<KpiData> {
  const now = new Date();
  const [today, week, month] = await Promise.all([
    aggregateForPeriod(prisma, getStartOfDay(now)),
    aggregateForPeriod(prisma, getStartOfWeek(now)),
    aggregateForPeriod(prisma, getStartOfMonth(now)),
  ]);

  return { today, week, month };
}

export async function getActivity(
  prisma: PrismaClient,
  limit: number = 20,
): Promise<ActivityItem[]> {
  const clampedLimit = Math.min(Math.max(1, limit), 50);

  const rows = await prisma.operation.findMany({
    include: { employee: { select: { full_name: true } } },
    orderBy: { created_at: "desc" },
    take: clampedLimit,
  });

  return rows.map((row) => ({
    id: row.id,
    employee_name: row.employee.full_name,
    employee_id: row.employee_id,
    operation_type: row.type,
    source: row.source,
    policy_number: row.policy_number,
    client_name: row.client_name,
    prime_net: row.prime_net?.toString() ?? null,
    created_at: row.created_at.toISOString(),
  }));
}

export function computePresenceStatus(lastHeartbeat: Date | null): PresenceStatus {
  if (!lastHeartbeat) return "offline";

  const now = Date.now();
  const diff = (now - lastHeartbeat.getTime()) / 1000; // seconds

  if (diff < 60) return "online";
  if (diff < 120) return "idle";
  return "offline";
}

export async function getPresence(
  prisma: PrismaClient,
): Promise<EmployeePresence[]> {
  const employees = await prisma.employee.findMany({
    where: { is_active: true },
    select: {
      id: true,
      full_name: true,
      last_heartbeat: true,
    },
    orderBy: { full_name: "asc" },
  });

  return employees.map((emp) => ({
    employee_id: emp.id,
    employee_name: emp.full_name,
    status: computePresenceStatus(emp.last_heartbeat),
    last_heartbeat: emp.last_heartbeat?.toISOString() ?? null,
  }));
}

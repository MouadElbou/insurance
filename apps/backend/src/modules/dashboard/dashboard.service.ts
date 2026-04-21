import type { PrismaClient } from "@prisma/client";
import type {
  KpiData,
  ActivityItem,
  EmployeePresence,
  PresenceStatus,
  ChartData,
  MonthlyTrendPoint,
  TypeBreakdown,
  SourceBreakdown,
  TopEmployee,
  DailyVolumePoint,
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

// ── Charts ──

const MONTH_LABELS: Record<number, string> = {
  1: "Jan", 2: "Fev", 3: "Mars", 4: "Avr", 5: "Mai", 6: "Juin",
  7: "Juil", 8: "Aout", 9: "Sept", 10: "Oct", 11: "Nov", 12: "Dec",
};

export async function getCharts(prisma: PrismaClient): Promise<ChartData> {
  const [monthlyTrend, byType, bySource, topEmployees, dailyVolume] =
    await Promise.all([
      getMonthlyTrend(prisma),
      getTypeBreakdown(prisma),
      getSourceBreakdown(prisma),
      getTopEmployees(prisma),
      getDailyVolume(prisma),
    ]);

  return {
    monthly_trend: monthlyTrend,
    by_type: byType,
    by_source: bySource,
    top_employees: topEmployees,
    daily_volume: dailyVolume,
  };
}

async function getMonthlyTrend(
  prisma: PrismaClient,
): Promise<MonthlyTrendPoint[]> {
  // Last 6 months
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const operations = await prisma.operation.findMany({
    where: { created_at: { gte: sixMonthsAgo } },
    select: { prime_net: true, commission: true, created_at: true },
  });

  const monthMap = new Map<
    string,
    { prime_net: number; commissions: number; count: number }
  >();

  // Initialize all 6 months
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { prime_net: 0, commissions: 0, count: 0 });
  }

  for (const op of operations) {
    const d = op.created_at;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key);
    if (entry) {
      entry.prime_net += Number(op.prime_net ?? 0);
      entry.commissions += Number(op.commission ?? 0);
      entry.count += 1;
    }
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const monthNum = parseInt(key.split("-")[1], 10);
      return {
        month: key,
        label: MONTH_LABELS[monthNum] ?? key,
        prime_net: Math.round(val.prime_net),
        commissions: Math.round(val.commissions),
        operations_count: val.count,
      };
    });
}

async function getTypeBreakdown(
  prisma: PrismaClient,
): Promise<TypeBreakdown[]> {
  const results = await prisma.operation.groupBy({
    by: ["type"],
    _count: { id: true },
    _sum: { prime_net: true },
  });

  return results.map((r) => ({
    type: r.type,
    count: r._count.id,
    prime_net: Math.round(Number(r._sum.prime_net ?? 0)),
  }));
}

async function getSourceBreakdown(
  prisma: PrismaClient,
): Promise<SourceBreakdown[]> {
  const results = await prisma.operation.groupBy({
    by: ["source"],
    _count: { id: true },
    _sum: { prime_net: true },
  });

  return results.map((r) => ({
    source: r.source,
    count: r._count.id,
    prime_net: Math.round(Number(r._sum.prime_net ?? 0)),
  }));
}

async function getTopEmployees(
  prisma: PrismaClient,
): Promise<TopEmployee[]> {
  const results = await prisma.operation.groupBy({
    by: ["employee_id"],
    _count: { id: true },
    _sum: { commission: true },
    orderBy: { _sum: { commission: "desc" } },
    take: 5,
  });

  const employeeIds = results.map((r) => r.employee_id);
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, full_name: true },
  });

  const nameMap = new Map(employees.map((e) => [e.id, e.full_name]));

  return results.map((r) => ({
    employee_id: r.employee_id,
    employee_name: nameMap.get(r.employee_id) ?? "Inconnu",
    total_commission: Math.round(Number(r._sum.commission ?? 0)),
    operations_count: r._count.id,
  }));
}

async function getDailyVolume(
  prisma: PrismaClient,
): Promise<DailyVolumePoint[]> {
  // Last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const operations = await prisma.operation.findMany({
    where: { created_at: { gte: thirtyDaysAgo } },
    select: { prime_net: true, created_at: true },
  });

  const dayMap = new Map<string, { count: number; prime_net: number }>();

  // Initialize all 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dayMap.set(key, { count: 0, prime_net: 0 });
  }

  for (const op of operations) {
    const key = op.created_at.toISOString().split("T")[0];
    const entry = dayMap.get(key);
    if (entry) {
      entry.count += 1;
      entry.prime_net += Number(op.prime_net ?? 0);
    }
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      count: val.count,
      prime_net: Math.round(val.prime_net),
    }));
}

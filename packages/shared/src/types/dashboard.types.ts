import type { OperationType, OperationSource } from "./operation.types.js";

export type PresenceStatus = "online" | "idle" | "offline";

export interface KpiData {
  today: {
    total_prime: string;
    total_commission: string;
    operations_count: number;
    policies_count: number;
  };
  week: {
    total_prime: string;
    total_commission: string;
    operations_count: number;
    policies_count: number;
  };
  month: {
    total_prime: string;
    total_commission: string;
    operations_count: number;
    policies_count: number;
  };
}

export interface ActivityItem {
  id: string;
  employee_name: string;
  employee_id: string;
  operation_type: OperationType;
  source: OperationSource;
  policy_number: string;
  client_name: string | null;
  prime_net: string | null;
  created_at: string;
}

export interface EmployeePresence {
  employee_id: string;
  employee_name: string;
  status: PresenceStatus;
  last_heartbeat: string | null;
}

// ── Chart data types ──

export interface MonthlyTrendPoint {
  month: string; // "2026-03"
  label: string; // "Mars"
  prime_net: number;
  commissions: number;
  operations_count: number;
}

export interface TypeBreakdown {
  type: OperationType;
  count: number;
  prime_net: number;
}

export interface SourceBreakdown {
  source: OperationSource;
  count: number;
  prime_net: number;
}

export interface TopEmployee {
  employee_id: string;
  employee_name: string;
  total_commission: number;
  operations_count: number;
}

export interface DailyVolumePoint {
  date: string; // "2026-03-15"
  count: number;
  prime_net: number;
}

export interface ChartData {
  monthly_trend: MonthlyTrendPoint[];
  by_type: TypeBreakdown[];
  by_source: SourceBreakdown[];
  top_employees: TopEmployee[];
  daily_volume: DailyVolumePoint[];
}

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

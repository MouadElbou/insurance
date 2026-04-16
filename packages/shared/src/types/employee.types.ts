export type Role = "MANAGER" | "EMPLOYEE";

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  operator_code: string;
  role: Role;
  is_active: boolean;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeRequest {
  email: string;
  password: string;
  full_name: string;
  operator_code: string;
  role: Role;
}

export interface UpdateEmployeeRequest {
  email?: string;
  password?: string;
  full_name?: string;
  operator_code?: string;
  role?: Role;
  is_active?: boolean;
}

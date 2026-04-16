import type { PresenceStatus } from "./dashboard.types.js";
import type { ActivityItem } from "./dashboard.types.js";
import type { UploadResult } from "./upload.types.js";
import type { Employee } from "./employee.types.js";

// Client -> Server events
export interface ClientToServerEvents {
  heartbeat: () => void;
  "join:dashboard": () => void;
  "leave:dashboard": () => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  "presence:update": (payload: PresenceUpdatePayload) => void;
  "operation:new": (payload: OperationNewPayload) => void;
  "upload:progress": (payload: UploadProgressPayload) => void;
  "upload:complete": (payload: UploadCompletePayload) => void;
  "employee:updated": (payload: EmployeeUpdatedPayload) => void;
}

export interface PresenceUpdatePayload {
  employee_id: string;
  status: PresenceStatus;
  last_heartbeat: string;
}

export interface OperationNewPayload {
  operation: ActivityItem;
}

export interface UploadProgressPayload {
  upload_id: string;
  processed_rows: number;
  total_rows: number;
}

export interface UploadCompletePayload {
  upload_id: string;
  result: UploadResult;
}

export interface EmployeeUpdatedPayload {
  employee: Employee;
}

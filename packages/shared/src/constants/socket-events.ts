export const SOCKET_EVENTS = {
  // Client -> Server
  HEARTBEAT: "heartbeat",
  JOIN_DASHBOARD: "join:dashboard",
  LEAVE_DASHBOARD: "leave:dashboard",
  // Server -> Client
  PRESENCE_UPDATE: "presence:update",
  OPERATION_NEW: "operation:new",
  UPLOAD_PROGRESS: "upload:progress",
  UPLOAD_COMPLETE: "upload:complete",
  EMPLOYEE_UPDATED: "employee:updated",
} as const;

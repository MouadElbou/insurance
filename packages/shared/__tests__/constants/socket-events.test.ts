import { describe, it, expect } from "vitest";
import { SOCKET_EVENTS } from "../../src/constants/socket-events.js";

describe("SOCKET_EVENTS", () => {
  it("should have all expected client-to-server events", () => {
    expect(SOCKET_EVENTS.HEARTBEAT).toBe("heartbeat");
    expect(SOCKET_EVENTS.JOIN_DASHBOARD).toBe("join:dashboard");
    expect(SOCKET_EVENTS.LEAVE_DASHBOARD).toBe("leave:dashboard");
  });

  it("should have all expected server-to-client events", () => {
    expect(SOCKET_EVENTS.PRESENCE_UPDATE).toBe("presence:update");
    expect(SOCKET_EVENTS.OPERATION_NEW).toBe("operation:new");
    expect(SOCKET_EVENTS.UPLOAD_PROGRESS).toBe("upload:progress");
    expect(SOCKET_EVENTS.UPLOAD_COMPLETE).toBe("upload:complete");
    expect(SOCKET_EVENTS.EMPLOYEE_UPDATED).toBe("employee:updated");
  });

  it("should have exactly 8 events", () => {
    expect(Object.keys(SOCKET_EVENTS)).toHaveLength(8);
  });
});

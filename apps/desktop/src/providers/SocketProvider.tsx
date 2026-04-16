import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useUploadsStore } from "@/stores/uploads.store";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { SOCKET_EVENTS, ROLES } from "@insurance/shared";
import { HEARTBEAT_INTERVAL } from "@/lib/constants";

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const addActivity = useDashboardStore((s) => s.addActivity);
  const updatePresence = useDashboardStore((s) => s.updatePresence);
  const setProgress = useUploadsStore((s) => s.setProgress);
  const setComplete = useUploadsStore((s) => s.setComplete);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(accessToken);

    // Register event listeners
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE as any, (payload: any) => {
      updatePresence(payload);
    });

    socket.on(SOCKET_EVENTS.OPERATION_NEW as any, (payload: any) => {
      if (payload?.operation) {
        addActivity(payload.operation);
      }
    });

    socket.on(SOCKET_EVENTS.UPLOAD_PROGRESS as any, (payload: any) => {
      setProgress(payload);
    });

    socket.on(SOCKET_EVENTS.UPLOAD_COMPLETE as any, (payload: any) => {
      if (payload?.result) {
        setComplete(payload.result);
      }
    });

    // Start heartbeat for EMPLOYEE role
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    if (user?.role === ROLES.EMPLOYEE) {
      heartbeatInterval = setInterval(() => {
        const currentSocket = getSocket();
        if (currentSocket?.connected) {
          currentSocket.emit(SOCKET_EVENTS.HEARTBEAT as any);
        }
      }, HEARTBEAT_INTERVAL);
    }

    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE as any);
      socket.off(SOCKET_EVENTS.OPERATION_NEW as any);
      socket.off(SOCKET_EVENTS.UPLOAD_PROGRESS as any);
      socket.off(SOCKET_EVENTS.UPLOAD_COMPLETE as any);

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      disconnectSocket();
    };
  }, [
    isAuthenticated,
    accessToken,
    user?.role,
    addActivity,
    updatePresence,
    setProgress,
    setComplete,
  ]);

  return <>{children}</>;
}

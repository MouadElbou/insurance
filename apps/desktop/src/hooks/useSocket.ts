import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@insurance/shared";

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    if (!socket) return;

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const joinDashboard = useCallback(() => {
    socket?.emit(SOCKET_EVENTS.JOIN_DASHBOARD as any);
  }, [socket]);

  const leaveDashboard = useCallback(() => {
    socket?.emit(SOCKET_EVENTS.LEAVE_DASHBOARD as any);
  }, [socket]);

  return { isConnected, joinDashboard, leaveDashboard, socket };
}

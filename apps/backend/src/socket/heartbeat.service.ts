import type { PrismaClient } from "@prisma/client";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PresenceUpdatePayload,
} from "@insurance/shared";
import { SOCKET_EVENTS } from "./events.js";
import { computePresenceStatus } from "../modules/dashboard/dashboard.service.js";
import { logger } from "../utils/logger.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

// Track previous status per employee so we only emit on *changes*
const previousStatus = new Map<string, string>();

let presenceInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Handle a heartbeat from an authenticated employee.
 * Updates last_heartbeat in DB and broadcasts a presence:update to the dashboard room.
 */
export async function handleHeartbeat(
  prisma: PrismaClient,
  io: IO,
  employeeId: string,
): Promise<void> {
  const now = new Date();

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { last_heartbeat: now },
    });

    const payload: PresenceUpdatePayload = {
      employee_id: employeeId,
      status: "online",
      last_heartbeat: now.toISOString(),
    };

    previousStatus.set(employeeId, "online");
    io.to("dashboard").emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
  } catch (err) {
    // Employee may have been deactivated or deleted — log but do not crash
    logger.warn({ employeeId, err }, "Heartbeat update failed");
  }
}

/**
 * Start a recurring interval (every 30 seconds) that checks all active employees
 * and broadcasts presence:update events when their status changes
 * (e.g., online -> idle -> offline based on last_heartbeat staleness).
 */
export function startPresenceChecker(prisma: PrismaClient, io: IO): void {
  if (presenceInterval) return; // already running

  presenceInterval = setInterval(async () => {
    try {
      const employees = await prisma.employee.findMany({
        where: { is_active: true },
        select: { id: true, last_heartbeat: true },
      });

      for (const emp of employees) {
        const newStatus = computePresenceStatus(emp.last_heartbeat);
        const prevStatus = previousStatus.get(emp.id);

        // Only broadcast when status actually changes
        if (prevStatus !== newStatus) {
          previousStatus.set(emp.id, newStatus);

          const payload: PresenceUpdatePayload = {
            employee_id: emp.id,
            status: newStatus,
            last_heartbeat: emp.last_heartbeat?.toISOString() ?? new Date(0).toISOString(),
          };

          io.to("dashboard").emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
        }
      }
    } catch (err) {
      logger.error({ err }, "Presence checker tick failed");
    }
  }, 30_000);

  logger.info("Presence checker started (30 s interval)");
}

/**
 * Stop the recurring presence checker interval.
 */
export function stopPresenceChecker(): void {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
    previousStatus.clear();
    logger.info("Presence checker stopped");
  }
}

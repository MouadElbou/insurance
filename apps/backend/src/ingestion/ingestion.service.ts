import type { PrismaClient } from "@prisma/client";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@insurance/shared";
import { SOCKET_EVENTS } from "@insurance/shared";
import { ExcelAdapter } from "./adapters/excel.adapter.js";
import { dedupAndPersist } from "./dedup.service.js";
import { logger } from "../utils/logger.js";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;

export async function ingestExcel(
  prisma: PrismaClient,
  fileBuffer: Buffer,
  uploadId: string,
  uploaderId: string,
  io: TypedIO,
): Promise<void> {
  const adapter = new ExcelAdapter();

  try {
    // Parse Excel file
    const operations = await adapter.parse(fileBuffer);
    const totalRows = operations.length;

    // Update upload with total row count
    await prisma.upload.update({
      where: { id: uploadId },
      data: { total_rows: totalRows, status: "PROCESSING" },
    });

    // Process in batches and emit progress events
    const BATCH_SIZE = 10;
    let processedRows = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = operations.slice(i, i + BATCH_SIZE);
      const result = await dedupAndPersist(prisma, batch, uploadId);

      totalCreated += result.created_count;
      totalUpdated += result.updated_count;
      totalSkipped += result.skipped_count;
      processedRows += batch.length;

      // Emit progress event
      io.to("dashboard").emit(SOCKET_EVENTS.UPLOAD_PROGRESS, {
        upload_id: uploadId,
        processed_rows: processedRows,
        total_rows: totalRows,
      });
    }

    // Update upload as completed
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "COMPLETED",
        created_count: totalCreated,
        updated_count: totalUpdated,
        skipped_count: totalSkipped,
        completed_at: new Date(),
      },
    });

    // Emit completion event
    io.to("dashboard").emit(SOCKET_EVENTS.UPLOAD_COMPLETE, {
      upload_id: uploadId,
      result: {
        upload_id: uploadId,
        status: "COMPLETED",
        total_rows: totalRows,
        created_count: totalCreated,
        updated_count: totalUpdated,
        skipped_count: totalSkipped,
        error_message: null,
      },
    });

    // Emit operation:new for new operations (aggregate notification)
    if (totalCreated > 0) {
      const recentOps = await prisma.operation.findMany({
        where: { upload_id: uploadId },
        include: { employee: { select: { full_name: true } } },
        orderBy: { created_at: "desc" },
        take: 5,
      });

      for (const op of recentOps) {
        io.to("dashboard").emit(SOCKET_EVENTS.OPERATION_NEW, {
          operation: {
            id: op.id,
            employee_name: op.employee.full_name,
            employee_id: op.employee_id,
            operation_type: op.type,
            source: op.source,
            policy_number: op.policy_number,
            client_name: op.client_name,
            prime_net: op.prime_net?.toString() ?? null,
            created_at: op.created_at.toISOString(),
          },
        });
      }
    }

    logger.info(
      {
        uploadId,
        totalRows,
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped,
      },
      "Excel ingestion complete",
    );
  } catch (err) {
    logger.error({ err, uploadId }, "Excel ingestion failed");

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        error_message: err instanceof Error ? err.message : "Erreur inconnue",
        completed_at: new Date(),
      },
    });

    io.to("dashboard").emit(SOCKET_EVENTS.UPLOAD_COMPLETE, {
      upload_id: uploadId,
      result: {
        upload_id: uploadId,
        status: "FAILED",
        total_rows: 0,
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        error_message: err instanceof Error ? err.message : "Erreur inconnue",
      },
    });
  }
}

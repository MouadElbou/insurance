import type { PrismaClient, Prisma } from "@prisma/client";
import type { Server } from "socket.io";
import type {
  Upload,
  PaginatedResponse,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@insurance/shared";
import { ingestExcel } from "../../ingestion/ingestion.service.js";
import { logger } from "../../utils/logger.js";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;

function toUploadResponse(
  row: Prisma.UploadGetPayload<{
    include: { uploaded_by: { select: { full_name: true } } };
  }>,
): Upload {
  return {
    id: row.id,
    filename: row.filename,
    file_size: row.file_size,
    status: row.status,
    error_message: row.error_message,
    total_rows: row.total_rows,
    created_count: row.created_count,
    updated_count: row.updated_count,
    skipped_count: row.skipped_count,
    uploaded_by_id: row.uploaded_by_id,
    uploaded_by_name: row.uploaded_by?.full_name,
    created_at: row.created_at.toISOString(),
    completed_at: row.completed_at?.toISOString() ?? null,
  };
}

export async function create(
  prisma: PrismaClient,
  file: { filename: string; data: Buffer; mimetype: string },
  uploadedById: string,
  io: TypedIO,
): Promise<Upload> {
  // Create upload record as PENDING
  const upload = await prisma.upload.create({
    data: {
      filename: file.filename,
      file_size: file.data.length,
      status: "PENDING",
      uploaded_by_id: uploadedById,
    },
    include: { uploaded_by: { select: { full_name: true } } },
  });

  // Start async processing (non-blocking)
  // We do NOT await this — the ingestion runs in the background
  ingestExcel(prisma, file.data, upload.id, uploadedById, io).catch((err) => {
    logger.error({ err, uploadId: upload.id }, "Background ingestion failed");
  });

  return toUploadResponse(upload);
}

export async function list(
  prisma: PrismaClient,
  filters: { status?: string; page?: number; per_page?: number },
): Promise<PaginatedResponse<Upload>> {
  const page = filters.page ?? 1;
  const perPage = filters.per_page ?? 25;

  const where: Prisma.UploadWhereInput = {};
  if (filters.status) {
    where.status = filters.status as Prisma.EnumUploadStatusFilter["equals"];
  }

  const [rows, totalItems] = await Promise.all([
    prisma.upload.findMany({
      where,
      include: { uploaded_by: { select: { full_name: true } } },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.upload.count({ where }),
  ]);

  return {
    items: rows.map(toUploadResponse),
    pagination: {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: Math.ceil(totalItems / perPage),
    },
  };
}

export async function getById(
  prisma: PrismaClient,
  id: string,
): Promise<Upload> {
  const row = await prisma.upload.findUnique({
    where: { id },
    include: { uploaded_by: { select: { full_name: true } } },
  });

  if (!row) {
    throw Object.assign(new Error("Upload introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  return toUploadResponse(row);
}

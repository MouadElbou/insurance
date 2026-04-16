import type { FastifyRequest, FastifyReply } from "fastify";
import type { UploadQueryInput } from "@insurance/shared";
import * as uploadsService from "./uploads.service.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".xlsx"];
const ALLOWED_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function createHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const file = await request.file();

  if (!file) {
    return reply.code(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Aucun fichier fourni.",
      },
    });
  }

  // Validate file extension
  const ext = file.filename.toLowerCase().slice(file.filename.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return reply.code(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Seuls les fichiers .xlsx sont acceptes.",
      },
    });
  }

  // Validate mimetype
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return reply.code(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Type de fichier invalide. Seuls les fichiers Excel (.xlsx) sont acceptes.",
      },
    });
  }

  // Read file buffer
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of file.file) {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Le fichier depasse la taille maximale de 10 Mo.",
        },
      });
    }
    chunks.push(chunk);
  }

  const data = Buffer.concat(chunks);

  const upload = await uploadsService.create(
    request.server.prisma,
    { filename: file.filename, data, mimetype: file.mimetype },
    request.user.sub,
    request.server.io,
  );

  return reply.code(202).send({
    success: true,
    data: { upload_id: upload.id, status: "processing" },
  });
}

export async function listHandler(
  request: FastifyRequest<{ Querystring: UploadQueryInput }>,
  reply: FastifyReply,
) {
  const result = await uploadsService.list(
    request.server.prisma,
    request.query,
  );

  return reply.code(200).send({ success: true, data: result });
}

export async function getByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const upload = await uploadsService.getById(
    request.server.prisma,
    request.params.id,
  );

  return reply.code(200).send({ success: true, data: upload });
}

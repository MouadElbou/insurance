import type { PrismaClient } from "@prisma/client";
import type { Server } from "socket.io";
import type {
  TokenPayload,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@insurance/shared";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    io: Server<ClientToServerEvents, ServerToClientEvents>;
  }

  interface FastifyRequest {
    user: TokenPayload;
  }
}

# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:20.11-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config, lockfile, and root tsconfig (needed by extends)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# Copy package.json and tsconfig files for dependency resolution
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/tsconfig.json apps/backend/tsconfig.json

# Install all dependencies (dev + prod needed for build)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared/src/ packages/shared/src/
COPY apps/backend/src/ apps/backend/src/
COPY apps/backend/prisma/ apps/backend/prisma/

# Build shared package first (backend depends on it)
RUN pnpm --filter @insurance/shared build

# Generate Prisma client
RUN pnpm --filter backend exec prisma generate

# Build backend TypeScript
RUN pnpm --filter backend build

# ─── Stage 2: Production ─────────────────────────────────────────
FROM node:20.11-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Add non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy package.json files for workspace resolution
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema and migrations (needed for generate + migrate deploy)
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Generate Prisma client in production context
# prisma is installed as devDep so we use npx to fetch just the CLI
RUN cd apps/backend && npx prisma@6 generate

# Copy shared package built output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy backend built output
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Switch to non-root user
USER appuser

EXPOSE 3001

# Health check against the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run migrations then start the server
CMD ["sh", "-c", "cd apps/backend && npx prisma@6 migrate deploy && cd /app && node apps/backend/dist/index.js"]

# Insurance Broker Tracker

Employee activity tracking application for a Moroccan insurance brokerage. Managers can track employee operations (production and emission), import data from Excel files (RMA format), monitor real-time employee presence, and view financial KPIs. Employees can view their own operations and manually enter new ones. All UI strings are in French; currency displayed in MAD (Moroccan Dirham).

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | Fastify 5, TypeScript 5, Prisma 6, PostgreSQL 16 |
| Desktop | Electron 33, React 18, Vite 6, Tailwind CSS 3.4, shadcn/ui |
| Real-time | Socket.IO 4.8 |
| Auth | JWT (15min access + 7d refresh with rotation) |
| Validation | Zod (shared between frontend and backend) |
| Deployment | Docker + Caddy reverse proxy |

## Project Structure

```
insurance/
  apps/
    backend/          # Fastify REST API + Socket.IO server
      prisma/         # Database schema, migrations, seed
      src/
        modules/      # auth, employees, operations, uploads, dashboard
        plugins/      # Fastify plugins (prisma, cors, rate-limit, socket-io)
        middleware/    # authenticate, authorize, validate
        ingestion/    # Excel parser adapter pattern
        socket/       # Socket.IO handlers and heartbeat service
    desktop/          # Electron + React desktop app (Windows)
      electron/       # Main process, preload, IPC, auto-updater
      src/            # React renderer (pages, components, stores, hooks)
  packages/
    shared/           # Shared types, Zod schemas, constants
```

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** and **Docker Compose** (for PostgreSQL, or install PostgreSQL 16 locally)
- **Git**

## Quick Start (Local Development)

### 1. Clone the repository

```bash
git clone <repository-url>
cd insurance
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env and set your DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

### 4. Start the database

```bash
docker compose up -d postgres
```

This starts PostgreSQL 16 on port 5432. The default credentials are in `docker-compose.yml` (user: `insurance`, password: set via `POSTGRES_PASSWORD`).

For local development with the simple database-only setup, you can use:

```bash
# Use the backend .env defaults (postgres:postgres@localhost:5432)
docker compose up -d postgres
```

### 5. Build the shared package

```bash
pnpm --filter @insurance/shared build
```

### 6. Generate Prisma client and run migrations

```bash
cd apps/backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

### 7. Seed the database

```bash
pnpm run db:seed
```

This creates a default manager account (`manager@insurance.ma` / `admin1234`) and a test employee (`employe1@insurance.ma` / `employee1234`).

### 8. Start the backend

```bash
pnpm run dev
```

The API server starts at `http://localhost:3001`. Health check: `http://localhost:3001/health`

### 9. Start the desktop app (separate terminal)

```bash
cd apps/desktop
pnpm run dev
```

## Running Tests

```bash
# Run all tests across all packages
pnpm -r test

# Run tests for a specific package
pnpm --filter backend test
pnpm --filter desktop test
pnpm --filter @insurance/shared test

# Watch mode
pnpm --filter backend test:watch
```

Tests require a running PostgreSQL instance for backend integration tests. Set `DATABASE_URL` in your environment or use the Docker Compose database.

## Production Deployment (Docker)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set ALL required values:
#   - POSTGRES_PASSWORD (strong password)
#   - JWT_SECRET (generate with: openssl rand -base64 48)
#   - JWT_REFRESH_SECRET (generate with: openssl rand -base64 48)
#   - DOMAIN (your actual domain name)
#   - CORS_ORIGIN (your Electron app origins)
```

### 2. Build and start all services

```bash
docker compose up -d --build
```

This starts:
- **postgres** -- PostgreSQL 16 database with persistent volume
- **backend** -- Fastify API (auto-runs migrations on startup)
- **caddy** -- Reverse proxy with automatic HTTPS (Let's Encrypt)

### 3. Verify deployment

```bash
# Check service status
docker compose ps

# Check backend health
curl http://localhost:3001/health

# View backend logs
docker compose logs -f backend
```

### 4. Seed the production database (first deployment only)

```bash
docker compose exec backend sh -c "cd apps/backend && npx tsx prisma/seed.ts"
```

### Updating

```bash
git pull
docker compose up -d --build
```

Migrations run automatically on container startup.

## API Overview

Base URL: `/api/v1`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/v1/auth/login | None | Login, returns JWT tokens |
| POST | /api/v1/auth/refresh | None | Refresh access token |
| POST | /api/v1/auth/logout | Bearer | Logout, revoke refresh token |
| GET | /api/v1/employees | Bearer (Manager) | List employees |
| GET | /api/v1/employees/:id | Bearer | Get employee details |
| POST | /api/v1/employees | Bearer (Manager) | Create employee |
| PATCH | /api/v1/employees/:id | Bearer (Manager) | Update employee |
| DELETE | /api/v1/employees/:id | Bearer (Manager) | Delete employee |
| GET | /api/v1/operations | Bearer | List operations (paginated) |
| GET | /api/v1/operations/:id | Bearer | Get operation details |
| POST | /api/v1/operations | Bearer | Create manual operation |
| GET | /api/v1/operations/stats | Bearer (Manager) | Operation statistics |
| GET | /api/v1/operations/export | Bearer (Manager) | Export operations as Excel |
| POST | /api/v1/uploads | Bearer (Manager) | Upload Excel file for import |
| GET | /api/v1/uploads | Bearer (Manager) | List upload history |
| GET | /api/v1/uploads/:id | Bearer (Manager) | Get upload details |
| GET | /api/v1/dashboard/kpis | Bearer (Manager) | Dashboard KPIs |
| GET | /api/v1/dashboard/activity | Bearer (Manager) | Recent activity feed |
| GET | /api/v1/dashboard/presence | Bearer (Manager) | Employee presence status |
| GET | /health | None | Health check |

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `JWT_SECRET` | Yes | -- | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | -- | Refresh token secret (min 32 chars) |
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3001` | Server port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt cost factor |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origins |

### Desktop (`apps/desktop/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend API URL |
| `VITE_SOCKET_URL` | No | Same as API URL | Socket.IO server URL |

### Docker Compose (root `.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_USER` | No | `insurance` | Database user |
| `POSTGRES_PASSWORD` | Yes | -- | Database password |
| `POSTGRES_DB` | No | `insurance_tracker` | Database name |
| `POSTGRES_PORT` | No | `5432` | Exposed database port |
| `JWT_SECRET` | Yes | -- | JWT signing secret |
| `JWT_REFRESH_SECRET` | No | Same as JWT_SECRET | Refresh token secret |
| `CORS_ORIGIN` | No | `app://.,file://` | Allowed CORS origins |
| `DOMAIN` | No | `insurance.example.com` | Domain for Caddy HTTPS |

## Available Scripts

### Root

| Script | Description |
|---|---|
| `pnpm dev:backend` | Start backend in development mode |
| `pnpm dev:desktop` | Start desktop app in development mode |
| `pnpm build:shared` | Build shared package |
| `pnpm build:backend` | Build backend |
| `pnpm build:desktop` | Build desktop (includes Electron packaging) |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Run Prettier across all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |

### Backend (`apps/backend/`)

| Script | Description |
|---|---|
| `pnpm dev` | Start with tsx watch (hot reload) |
| `pnpm build` | Compile TypeScript to dist/ |
| `pnpm start` | Run compiled output |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Create and apply migrations |
| `pnpm db:push` | Push schema without migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm test` | Run tests |

## Scraper Ingestion

The desktop app silently captures scraper events from insurer web portals as employees browse them. Capture runs in the background through Electron's `WebContentsView` + `session.webRequest` + Chrome DevTools Protocol — employees keep using their existing portal workflow and the backend ingests the HTTP payloads that match a manager-curated allowlist.

### How it works

1. **Allowlist lives server-side.** Managers register insurer host patterns through the `InsurerDomain` CRUD (`Parametres > Domaines assureurs`). Each entry carries a `host_pattern` (regex), `insurer_code` (enum from `@insurance/shared`), `capture_enabled` flag, and optional `transformer_notes`.
2. **Two-layer regex safety.** Host patterns are validated by a shared Zod schema (`packages/shared/src/schemas/scraper.schema.ts`) that runs the `safe-regex` check at write-time; the desktop allowlist compiler re-validates with a try/catch at runtime (`apps/desktop/electron/allowlist.ts`). Unsafe patterns are rejected both on save and during portal load.
3. **Silent capture.** The Electron main process wires `session.defaultSession.webRequest.onCompleted` + `debugger.attach("Network")` so navigation and background XHR/fetch requests with a matching host are siphoned into a buffered queue. Requests never reach the React renderer.
4. **Authenticated forwarding.** The main process reads the encrypted JWT from `tokens.dat` (via `safeStorage`) and batches captured events to `POST /api/v1/scraper/events` with `SCRAPER_MAX_BATCH` rows per request.
5. **Server-side dedup + retention.** The backend upserts by `(insurer_code, avenant_number, quittance_number, captured_at)` — null-aware via Prisma `IS NULL` — and a nightly job purges rows older than `SCRAPER_RETENTION_DAYS` days by `captured_at`.

### Managing insurer domains (manager-only)

`GET/POST/PATCH/DELETE /api/v1/scraper/domains` — CRUD guarded by `authenticate` + `authorize("MANAGER")` + per-user rate limit (keyed on JWT `sub`, not `req.ip`).

| Field | Validation | Notes |
|---|---|---|
| `host_pattern` | Zod + `safe-regex` (no catastrophic backtracking) | Example: `^portal\\.assureur-x\\.ma$` |
| `insurer_code` | Enum from `@insurance/shared` | e.g. `RMA`, `WAFA`, `SAHAM` |
| `capture_enabled` | Boolean | Toggle without deleting the entry |
| `transformer_notes` | Optional string | Describes portal-specific field mapping (single name across the stack) |

Unsafe or invalid patterns surface as `AllowlistRejection` records and are surfaced in the UI; they are logged but never compiled.

### Local development (scraper surface)

```bash
# 1. Backend env (adds scraper keys)
cp apps/backend/.env.example apps/backend/.env
# Ensure SCRAPER_MAX_BATCH and SCRAPER_RETENTION_DAYS are set (defaults below).

# 2. Desktop env (unchanged — uses VITE_API_URL)
cp apps/desktop/.env.example apps/desktop/.env

# 3. Seed includes a default InsurerDomain row for local testing
pnpm --filter backend run db:seed
```

The seed inserts a `capture_enabled: false` domain you can flip on from the UI for smoke-testing without live traffic.

### Scraper environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SCRAPER_MAX_BATCH` | No | `50` | Max events per `POST /api/v1/scraper/events` batch |
| `SCRAPER_RETENTION_DAYS` | No | `90` | Purge events older than N days (by `captured_at`) |

Already present in `apps/backend/.env.example:11-12`.

### Encrypted JWT storage

The desktop app stores the refresh JWT in `tokens.dat` encrypted via Electron `safeStorage`. The file is created on first login and is `.gitignore`d at both repo root and any working directory — never commit it. If `safeStorage.isEncryptionAvailable()` returns `false` (OS keychain unavailable), the fallback path logs a warning and stores the token in plaintext; production packaging should harden this to a hard failure. See `apps/desktop/electron/ipc-handlers.ts`.

### Testing the scraper surface

```bash
# Backend scraper suite (69 tests)
pnpm --filter backend test -- scraper

# Desktop allowlist + capture tests (5 tests)
pnpm --filter desktop test -- scraper

# Shared Zod + regex-safety regression tests (74 tests)
pnpm --filter @insurance/shared test
```

## License

Private -- proprietary software.

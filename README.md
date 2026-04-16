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

## License

Private -- proprietary software.

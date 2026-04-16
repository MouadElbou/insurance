# Onboarding Guide

You just joined the Insurance Broker Tracker project. Here is what you need to know.

---

## Architecture Overview

This is a monorepo with three packages: a Fastify 5 REST API backend (with Socket.IO for real-time events), an Electron 33 desktop app (React 18 + Vite 6), and a shared validation/types package consumed by both. The backend tracks insurance operations (production and emission types) imported from RMA-format Excel files or entered manually. A single manager oversees ~30 employees. All UI is in French; currency is MAD (Moroccan Dirham). Data flows: Excel upload -> parser -> database, or manual entry -> API -> database. The manager dashboard receives real-time updates via Socket.IO (new operations, employee presence heartbeats).

---

## Key Files and What They Do

### Backend (`apps/backend/`)

| File | Purpose |
|---|---|
| `src/index.ts` | Entry point. Bootstraps the Fastify app, starts the presence checker, binds to `PORT`. |
| `src/app.ts` | Builds the Fastify instance. Registers all plugins (prisma, cors, rate-limit, error-handler, multipart, socket-io), the `/health` endpoint, and all API routes under `/api/v1`. Sets up hourly refresh token cleanup. |
| `src/config.ts` | Loads and validates environment variables with Zod. If a required var is missing or invalid, the app crashes on startup with a clear error. |
| `src/modules/auth/` | Login, refresh, logout handlers and service. JWT access (15min) + opaque refresh (7d) with rotation. |
| `src/modules/employees/` | CRUD for employee records. Manager-only for create/update/delete. |
| `src/modules/operations/` | CRUD + stats + Excel export for insurance operations. Employees see only their own. |
| `src/modules/uploads/` | Excel file upload and async processing. Emits Socket.IO progress events. |
| `src/modules/dashboard/` | KPIs, activity feed, and presence status aggregation. Manager-only. |
| `src/middleware/authenticate.ts` | Extracts and verifies the JWT Bearer token from `Authorization` header. Attaches `request.user`. |
| `src/middleware/authorize.ts` | Checks `request.user.role` against allowed roles. Returns 403 if not authorized. |
| `src/middleware/validate.ts` | Validates request body (or querystring) against a Zod schema. Returns 400 with structured errors. |
| `src/ingestion/` | Adapter-pattern Excel parser. Reads RMA-format `.xlsx` files, extracts rows, resolves `operator_code` to `employee_id`, upserts operations. |
| `src/plugins/prisma.ts` | Fastify plugin that creates the PrismaClient and exposes it as `app.prisma`. Disconnects on app close. |
| `src/plugins/socket-io.ts` | Attaches Socket.IO server to Fastify. Handles authentication, room joins, heartbeat events. |
| `prisma/schema.prisma` | Database schema: Employee, Operation, Upload, RefreshToken models. Single table inheritance for operations (type discriminator). |
| `prisma/seed.ts` | Creates default manager (`manager@insurance.ma` / `admin1234`) and test employee (`employe1@insurance.ma` / `employee1234`). Idempotent via upsert. |

### Shared (`packages/shared/`)

| File | Purpose |
|---|---|
| `src/schemas/` | Zod validation schemas shared between frontend and backend: `createOperationSchema`, `operationFiltersSchema`, `loginSchema`, `createEmployeeSchema`, etc. |
| `src/types/` | TypeScript type definitions derived from Zod schemas plus additional shared types (API envelope, pagination, etc.). |
| `src/constants.ts` | Shared constants: operation types, roles, upload statuses, pagination defaults. |

### Desktop (`apps/desktop/`)

| File | Purpose |
|---|---|
| `electron/main.ts` | Electron main process. Creates the BrowserWindow, sets up IPC handlers, manages auto-updates. |
| `electron/preload.ts` | Preload script. Exposes a secure IPC bridge for token storage (`safeStorage`), app info, and window controls. |
| `src/App.tsx` | React entry point. Sets up routing, auth context, and socket connection. |
| `src/stores/` | Zustand stores for auth state, employee data, operations, and real-time presence. Updated from Socket.IO events outside React. |
| `src/pages/` | Page components: Login, Dashboard, Operations, Employees, Uploads. |
| `src/components/` | Reusable UI components built on shadcn/ui primitives. |

---

## How to Add a New API Endpoint

Example: adding a `GET /api/v1/operations/summary` endpoint.

### Step 1: Add the Zod schema (if needed)

If the endpoint accepts query parameters or a request body, add a Zod schema in `packages/shared/src/schemas/`:

```typescript
// packages/shared/src/schemas/operations.ts
export const operationSummaryQuerySchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
```

Export it from `packages/shared/src/index.ts`. Rebuild the shared package:

```bash
pnpm --filter @insurance/shared build
```

### Step 2: Write the service function

Add business logic in the module's service file:

```typescript
// apps/backend/src/modules/operations/operations.service.ts
export async function getOperationSummary(
  prisma: PrismaClient,
  filters: { date_from?: string; date_to?: string },
) {
  // Your query logic here
  const result = await prisma.operation.aggregate({ ... });
  return result;
}
```

### Step 3: Write the handler

Add a handler function in the module's handler file:

```typescript
// apps/backend/src/modules/operations/operations.handler.ts
export async function summaryHandler(
  request: FastifyRequest<{ Querystring: OperationSummaryQuery }>,
  reply: FastifyReply,
) {
  const summary = await getOperationSummary(
    request.server.prisma,
    request.query,
  );
  return reply.send({ success: true, data: summary });
}
```

### Step 4: Register the route

Add the route in the module's routes file:

```typescript
// apps/backend/src/modules/operations/operations.routes.ts
fastify.get("/summary", {
  preHandler: [authorize("MANAGER"), validate(operationSummaryQuerySchema, "querystring")],
  handler: summaryHandler,
});
```

The middleware chain is: `authenticate` (added as a hook on the whole module) -> `authorize("MANAGER")` -> `validate(schema)` -> `handler`.

### Step 5: Test

Write a test in `apps/backend/src/modules/operations/__tests__/`:

```typescript
// operations.summary.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../../../app.js";

describe("GET /api/v1/operations/summary", () => {
  it("returns summary for manager", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/operations/summary",
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });
});
```

---

## How to Add a New Desktop Page

Example: adding a "Reports" page at `/reports`.

### Step 1: Create the page component

```typescript
// apps/desktop/src/pages/Reports.tsx
export default function ReportsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Rapports</h1>
      {/* Your page content */}
    </div>
  );
}
```

### Step 2: Add the route

In the router configuration (likely `src/App.tsx` or `src/router.tsx`), add the route:

```typescript
<Route path="/reports" element={<ReportsPage />} />
```

### Step 3: Add navigation

Add a link in the sidebar/navigation component:

```typescript
<NavLink to="/reports">Rapports</NavLink>
```

### Step 4: Connect to the API

Use a Zustand store or React Query to fetch data:

```typescript
// src/stores/reports.ts
import { create } from "zustand";
import { api } from "../lib/api";

interface ReportsStore {
  data: Report[] | null;
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useReportsStore = create<ReportsStore>((set) => ({
  data: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const response = await api.get("operations/stats").json();
    set({ data: response.data, loading: false });
  },
}));
```

---

## How to Run and Write Tests

### Running tests

```bash
# All tests across all packages
pnpm -r test

# Backend tests only
pnpm --filter backend test

# Watch mode (re-runs on file changes)
pnpm --filter backend test:watch
```

### Test setup

Backend tests use Vitest and Fastify's `app.inject()` for HTTP testing without starting a real server. Integration tests need a running PostgreSQL instance (use Docker Compose or set `DATABASE_URL`).

### Writing a test

Tests go in `__tests__/` directories next to the code they test:

```
src/modules/auth/
  auth.handler.ts
  auth.routes.ts
  auth.service.ts
  __tests__/
    auth.login.test.ts
    auth.refresh.test.ts
```

Pattern:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app.js";
import type { FastifyInstance } from "fastify";

describe("Feature description", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should do something", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/some-endpoint",
      headers: { authorization: "Bearer <token>" },
    });
    expect(response.statusCode).toBe(200);
  });
});
```

---

## Common Gotchas

1. **Shared package must be built before the backend.** If you see import errors for `@insurance/shared`, run `pnpm --filter @insurance/shared build` first. The shared package compiles from TypeScript to JavaScript in `dist/`. The backend imports the compiled output, not the source.

2. **Prisma client must be generated after any schema change.** After editing `prisma/schema.prisma`, run `pnpm --filter backend exec prisma generate` before typechecking or building. If you forget, TypeScript will not recognize new models or fields.

3. **Migrations are separate from `prisma generate`.** `prisma generate` updates the local client types. `prisma migrate dev` creates a new migration SQL file. `prisma migrate deploy` applies pending migrations to the database. In production (Docker), `migrate deploy` runs automatically on container startup.

4. **Financial values are Decimal, not number.** All monetary fields (`prime_net`, `commission`, `tax_amount`, etc.) are `Decimal(12,2)` in PostgreSQL. Prisma returns them as `Prisma.Decimal` objects. The API serializes them as strings (`"1500.00"`) to preserve precision across JSON transport. Never convert to `number` for calculations.

5. **CORS_ORIGIN is singular, not plural.** The env var is `CORS_ORIGIN`, not `CORS_ORIGINS`. Accepts comma-separated origins (e.g., `app://.,file://,http://localhost:5173`).

6. **The Electron app uses `safeStorage` for tokens.** Tokens are encrypted via the OS credential store (DPAPI on Windows). The renderer cannot access tokens directly -- everything goes through the preload IPC bridge. If you are testing the desktop app outside Electron (e.g., in a browser), token storage will not work.

7. **Socket.IO authentication.** The Socket.IO server expects the access token in the handshake: `io({ auth: { token: "<jwt>" } })`. If the token expires, the socket disconnects and the client must reconnect with a fresh token.

8. **Employee operator_code links Excel rows to employees.** When an Excel file is uploaded, the parser extracts the operator code from each row and looks up the matching `Employee.operator_code` in the database. If no match is found, the row is skipped (counted in `skipped_count`). Make sure every employee has a unique, correct `operator_code` before importing.

9. **The operations table uses single table inheritance.** Both PRODUCTION and EMISSION operations are in one table. Type-specific fields (e.g., `avenant_number` for production, `quittance_number` for emission) are nullable in the database. The Zod schemas enforce which fields are required per type at the API level.

10. **Rate limiting on auth endpoints.** Login is limited to 5 requests/minute per IP. Refresh is 10/minute. If you are running automated tests, use `app.inject()` (which bypasses the network) or reset the rate limiter between tests.

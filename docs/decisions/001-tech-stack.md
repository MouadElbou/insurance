# ADR 001: Technology Stack Selection

**Date**: 2026-04-15
**Status**: Accepted

## Context

We are building an employee activity tracking system for a single insurance brokerage in Morocco. The application needs to:
- Track production and emission operations for ~10-30 employees
- Import data from RMA-format Excel files
- Provide real-time presence monitoring and dashboard updates
- Run as a Windows desktop application with a centralized backend
- Support a single manager overseeing all employees
- Display all UI in French with MAD currency formatting

The deployment target is a single VPS. The codebase will be maintained by a solo developer after handoff.

## Decision

### Backend: Fastify 5 + Prisma 6 + PostgreSQL 16

**Fastify** was chosen over Express because it provides built-in schema validation, a plugin architecture that enforces encapsulation, and significantly better throughput. At this scale (30 concurrent users) raw performance is not critical, but Fastify's structured approach to route registration and lifecycle hooks makes the codebase more maintainable for a solo developer.

**Prisma 6** was chosen over Drizzle, TypeORM, or raw SQL for its type-safe query builder, migration system, and Decimal field support (required for MAD financial values). The generated types flow directly into API response types, reducing manual type maintenance.

**PostgreSQL 16** was chosen over SQLite or MySQL because it supports JSONB (for future metadata), has robust Decimal precision for financial data, and is the industry standard pairing with Prisma.

### Frontend: Electron 33 + React 18 + Tailwind CSS + shadcn/ui

**Electron** is required for the Windows desktop app with system tray, auto-updater, and secure token storage via `safeStorage`. The tradeoff of bundle size (~150MB) is acceptable for a corporate desktop deployment.

**React 18** with **Vite 6** provides fast development iteration. React was chosen over Svelte or Vue for its ecosystem breadth and the availability of shadcn/ui.

**shadcn/ui** was chosen over full component libraries (Ant Design, MUI) because it provides unstyled, copy-paste components that we own and can customize to match the brokerage's visual identity. Combined with Tailwind, this avoids the common problem of fighting a component library's styling.

### State Management: Zustand 5

Chosen over Redux (too much boilerplate for this scale) and React Context (causes unnecessary re-renders with frequent real-time updates from Socket.IO). Zustand stores can be updated from outside React (socket event handlers), which is critical for the real-time presence system.

### Real-time: Socket.IO 4.8

Chosen for its built-in room system (dashboard room for managers, per-user rooms for upload progress), automatic reconnection, and polling fallback. At ~30 concurrent WebSocket connections, no Redis adapter is needed.

### Monorepo: pnpm workspaces

Enables the shared types package (`@insurance/shared`) that contains Zod validation schemas used by both frontend and backend. This eliminates type drift between API request validation and form validation.

## Consequences

- **Positive**: Strong type safety from database to UI through Prisma types, shared Zod schemas, and TypeScript everywhere.
- **Positive**: Minimal dependency count keeps maintenance burden low for a solo developer.
- **Positive**: pnpm workspaces avoid the complexity of Turborepo or Nx for a 3-package monorepo.
- **Negative**: Electron increases desktop app size significantly. Acceptable for a corporate Windows deployment.
- **Negative**: pnpm is less commonly known than npm/yarn, which may require the maintaining developer to learn it.
- **Negative**: Prisma adds a build step (client generation) that must run before typechecking or building. This is handled by CI and Docker build scripts.

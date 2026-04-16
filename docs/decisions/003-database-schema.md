# ADR 003: Database Schema Design

**Date**: 2026-04-15
**Status**: Accepted

## Context

The insurance brokerage tracks two types of operations from RMA Excel reports:
1. **Production** (EtatJournalierProduction): Policies created/modified, with avenant and attestation numbers.
2. **Emission** (EtatJournalierEmissionsQuittance): Quittances emitted, with tax breakdowns and commissions.

These operations share most fields but have type-specific columns (e.g., `avenant_number` is only for production, `quittance_number` and tax fields are only for emission).

We also need to:
- Link operations to the employee who owns them (via `operator_code` from Excel)
- Track upload history with processing statistics
- Deduplicate operations when the same Excel is re-uploaded
- Store refresh tokens for revocation

Design alternatives considered:
1. **Separate tables per operation type** (production_operations, emission_operations): Cleaner per-type, but doubles query complexity for combined views, statistics, and the activity feed.
2. **Single table with nullable type-specific columns** (chosen): Some nulls, but vastly simpler queries and a single TanStack Table configuration on the frontend.
3. **EAV pattern or JSONB for type-specific fields**: Loses type safety and makes indexing harder.

## Decision

### Single Operations Table with Type Discriminator

All operations go into one `operations` table with a `type` enum (`PRODUCTION` | `EMISSION`). Columns specific to one type are nullable:
- `avenant_number`, `attestation_number`, `event_type` -- only populated for PRODUCTION
- `quittance_number`, `tax_amount`, `parafiscal_tax`, `total_prime`, `commission` -- only populated for EMISSION

This is the standard Single Table Inheritance pattern. The Zod validation schemas enforce which fields are required per type, so the database allows nulls but the API does not.

### Deduplication Strategy

Operations are deduplicated by a composite unique constraint:
```
@@unique([type, policy_number, avenant_number, quittance_number])
```

When an Excel file is re-uploaded, the ingestion service uses `upsert` on this composite key. This means:
- Same policy + avenant (production) = update, not duplicate
- Same policy + quittance (emission) = update, not duplicate
- The `source` field tracks whether the record came from EXCEL, MANUAL, or SCRAPER

### Financial Fields as Decimal(12,2)

All monetary values use `Decimal(12,2)` in PostgreSQL (via Prisma's `@db.Decimal(12,2)`). This avoids floating-point precision issues with currency. Values are serialized as strings in the API to preserve precision across JSON transport. The frontend formats them with MAD currency display.

### Employee Linking via operator_code

The `operator_code` field on `Employee` (e.g., `"int46442"`) matches the operator identifier in RMA Excel files. During ingestion, the parser extracts the operator code and resolves it to an `employee_id` via database lookup. If no matching employee exists, the row is skipped and counted in `skipped_count`.

### Refresh Token Table

Refresh tokens are stored as bcrypt hashes with `is_revoked` and `expires_at` fields. An hourly cleanup job (in `app.ts` onReady hook) deletes expired and revoked tokens to prevent table bloat. The `jti` (JWT ID) field provides a unique identifier for each token independent of the hash.

## Consequences

- **Positive**: Single operations table simplifies all queries, statistics, exports, and the real-time activity feed.
- **Positive**: Composite unique constraint prevents duplicate operations without application-level locks.
- **Positive**: Decimal fields prevent floating-point currency errors.
- **Positive**: Cascade delete on employee removes all their operations and tokens -- clean deactivation.
- **Negative**: Nullable columns mean the database schema does not enforce per-type field requirements. The Zod validation layer compensates.
- **Negative**: As the operations table grows (thousands of rows over months), some queries may need additional composite indexes. The current index set covers all filter/sort patterns in the API.
- **Tradeoff**: `onDelete: SetNull` on the Upload relation means operations survive even if their upload record is deleted. This preserves manually-edited data.

# Neon PostgreSQL Database Operations Runbook

## Connection Strings & Pooling Discipline

- **Serverless Runtime (`DATABASE_URL`):** Always point Vercel Serverless API (`apps/api`) and scripts at Neon's pooled `-pooler` hostname (`sslmode=require`) with PgBouncer transaction pooling enabled.
- **Schema Migrations (`DIRECT_URL`):** Run `prisma migrate deploy` or schema push operations against Neon's direct (unpooled) connection string so advisory locks and DDL statements complete cleanly.
- **Lifecycle Hygiene:** `PrismaService` (`apps/api/src/prisma/prisma.service.ts`) implements both `OnModuleInit` (`$connect()`) and `OnModuleDestroy` (`$disconnect()`), releasing connections deterministically on process teardown and tests.

## Read/Write Guardrails & User #1 Golden Ledger Protection

1. **User #1 (`userId = 1`, `cheeseburger`) Is Production-Live:** Never run automated test writes, seed scripts, or ad-hoc mutations against `userId = 1`.
2. **Test Mutation Isolation:** All write E2E suites (`erp-bug-bounty.ts`, `erp-pentest.ts`, sandbox tests) execute exclusively against `userId = 2` (Demo Sandbox) or temporary test users (`userId >= 3`) cleaned up before finishing.
3. **Reads Never Mutate:** `GET` endpoints and NestJS `.selectors.ts` modules perform pure read queries and never alter database rows as a side effect.
4. **Strict Parameterization:** Raw Postgres admin inspection queries in `SqlStudioService` parameterize `tableName`, `userId`, and `search` predicates (`$1..$N`) and validate table identifiers against `information_schema.tables`.

## Neon Branching Workflow for Risky Changes

Before testing schema migrations, bulk backfill scripts, or engine upgrades:
1. Create an isolated Neon database branch from `main` in the Neon Console or CLI.
2. Run `prisma migrate deploy`, `npm run erp:doctor`, and `npx tsx scripts/verify-zero-defect-erp.ts` against the branch connection string.
3. Verify `0 Rp` drift across User #1 (`userId = 1`) snapshots and `LiabilityLineItem` <-> `MonthlyBulkBill` parity before promoting migrations to production `main`.

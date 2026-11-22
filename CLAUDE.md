# CLAUDE.md - Sunday Funday ERP Session Index

Read this file together with `AGENTS.md` before making database or calculation changes.

## Zero-Discovery Ground Truth Workflow

Do NOT write ad-hoc discovery scripts to inspect database state. Use the documented docs and CLI commands directly:

- `docs/LIVE_LEDGER_STATE.md` - Latest verified Neon Cloud snapshot, 12-Month Debt Matrix, `LiabilityLineItem` sub-ledger, Credit Card schedules, and Savings ledger for `userId = 1`.
- `docs/FINANCIAL_DOMAIN_RULES.md` - Consumption/maturity paycycle horizon (`Payday(M-1)` through `Day before Payday(M)`), dynamic SPayLater (`daysInMonth - 15` -> 25th) & Permata CC (`25th` -> 11th H-1 business day) cutoff rules, 2-priority waterfall locks, and Zero Double-Counting invariant.
- `docs/PAYCYCLE_HORIZON_AND_CUTOFF_LAW.md` - Two-stage payday calendar, exact cutoff schedules, and Cash Radar (`radar.go` / `/calendar`) Lowest Cash Point rules.
- `docs/AI_CONTEXT_MAP.md` - Exact file and symbol index across `apps/api`, `apps/go-engine`, and `apps/web`.

## CLI Operations (`scripts/erp-cli.ts`)

- `npm run erp:report -- --write` - Query live Neon Cloud state for `userId = 1` and refresh `docs/LIVE_LEDGER_STATE.md`.
- `npm run erp:sync` - Mirror `userId = 1` records safely from Neon Cloud -> Local PostgreSQL (`127.0.0.1:5433`, requires local TCP proxy `apps/api/scripts/tcp-proxy.ts` when Postgres runs on `5432`).
- `npm run erp:doctor` - Verify 0 Rp engine drift on `9/2026`+, 100% `LiabilityLineItem` <-> `MonthlyBulkBill` parity, and 100% Neon <-> Local sync.
- `npm run erp:item:add -- --title "..." --category PAYLATER|PERSONAL_DEBT|P1_VAULT_REFUND --amount <n> --month <m> --year <y> [--tenor 3] [--hold-past-cutoff true]`
- `npm run erp:item:shift -- --id <id> --dir EARLIER|LATER [--split <amount>]`

## Live Data Protection

Never mutate historical `userId = 1` periods without reading live Neon Cloud state first and verifying `npm run erp:doctor` exits with code `0` afterward. Visual UI changes must also pass **Layer 5 Browser QA** (desktop screenshot verification + dev-leakage check) alongside the 4 automated CLI test layers.

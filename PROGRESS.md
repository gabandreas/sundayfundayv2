# PROGRESS.md — Current State Log

This file is the single source of truth for "what's actually been built so far." It is not a changelog — it is not organized by version or date-ordered history. It reflects the current state of the project, updated in place.

**Update this file every time a meaningful chunk of work is finished** — a feature completed, a decision locked in, a module refactored. If you (the AI agent) are starting a new session, read this file completely before touching any code. If you finish work and don't update this file, the next session starts blind.

---

## Current State

Monorepo scaffolding and Phases 0–10 (including Multi-Tenant SaaS Architecture, 4-Tier RBAC, Life-Stage Presets, Transactional Database Backup Restore, Reverse-Proxy IP Rate Limiting, Mobile PWA & Ergonomics, and Full Docker Production Setup) are fully implemented and verified:
- `apps/web` (Next.js 16.3.4 + Tailwind, Turbopack/Webpack) runs on **http://localhost:3000** (`npm run build --workspace=apps/web` passes with 0 errors across all 17 routes, including the responsive mobile cockpit, PWA manifest, and the 4-tab `/admin` console).
- `apps/api` (NestJS) runs on **http://localhost:3001** with Prisma ORM v6 (`npm run build --workspace=apps/api` passes with 0 errors).
- Database schema synchronized on Docker Postgres **host port 5433** (`127.0.0.1:5433`).
  - Live dev database: `finance_erp` (contains the owner's real financial data; 0 Rp shift across all historical `7/2026`–`12/2026` periods under `userId = 1`).
  - Isolated test database: `finance_erp_test` (enforced by `apps/api/test/setup.ts`, which throws if `DATABASE_URL` points to `finance_erp`).
- Calculator module at `apps/api/src/calculator/` — 11 pure calculation modules (`payroll.ts`, `waterfall.ts`, `pacing.ts`, `discipline.ts`, `wishlist.ts`, `analytics.ts`, `credit-limit.ts`, `reconciliation.ts`, `reports.ts`, `forecasting.ts`, `modular-engine.ts`) plus `apps/api/src/credit/credit.utils.ts` and `apps/api/src/savings/savings.utils.ts` with zero I/O.
- Security & Production Hardening Module:
  - Reverse Proxy IP Resolution (`extractClientIp` checking `cf-connecting-ip` -> `x-forwarded-for` -> `x-real-ip` -> remote address with `::ffff:` stripping).
  - In-Memory Brute-Force Rate Limiting (`RateLimiterService` locking after 5 failures for 15 minutes with HTTP 429).
  - Transactional Database Backup Restore Engine (`POST /api/admin/backup/restore`) supporting `VALIDATE_DRY_RUN` and atomic `$transaction` `RESTORE_OVERWRITE` with automated PostgreSQL sequence (`setval`) resets.
  - Multi-stage Docker builds (`apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.prod.yml`, `.env.example`).
  - Responsive Mobile Navigation & PWA Manifest (`manifest.json`, slide-over drawer, mobile priority ordering on `< 768px`).
- Test suite status (verified against `finance_erp_test`):
  - **Unit tests (`npm run test --workspace=apps/api`)**: **14 suites passed (14 total), 122 tests passed (122 total)**.
  - **E2E / integration tests (`npm run test:e2e --workspace=apps/api`)**: **14 suites passed (14 total), 167 tests passed (167 total)**.

---

## Completed

- Workspace root `package.json` with npm workspaces (`apps/*`), root `.eslintrc.js`, `.prettierrc`, and `docker-compose.yml` (host port 5433)
- `apps/api/prisma/schema.prisma` — all 11 entities with 11 migrations applied:
  1. `20260906131115_init`
  2. `20260906133316_sync_snapshot_targets_and_waterfall_fields`
  3. `20260907065235_expand_credit_card_and_transaction_sources`
  4. `20260907132750_update_audit_log_schema`
  5. `20260911071951_expand_wishlist_item`
  6. `20260912134500_expand_monthly_bulk_bill_breakdown`
  7. `20260918094333_add_budget_revision_model`
  8. `20260919040808_expand_budget_revisions_and_payday`
  9. `20260919103410_add_payroll_payout_date`
  10. `20261025063500_add_credit_usage_limits`
  11. `20261025090000_erp_core_completeness`
  12. `20261026060000_add_modular_formula_engine`
- Isolated test database guard in `apps/api/test/setup.ts` enforcing `finance_erp_test` on `127.0.0.1:5433` and destructive flag guard (`--i-understand-this-wipes-live-data`) in `apps/api/prisma/seed.ts`
- Calculator module (`apps/api/src/calculator/`):
  - `payroll.ts`: payroll calculation + standalone `calculateDecemberProratedThr`
  - `waterfall.ts`: single-source deduction sum (`calculateTotalDeductions`) + 2-priority waterfall allocation (`calculateWaterfall`) with upfront fixed essentials and `dailyOperationalTarget`
  - `pacing.ts`: payday-to-payday variable cycle (`calculatePacingDays`, `calculateDailyPacing`, `getPayrollPeriodForDate`, `formatCycleDateLabel`)
  - `discipline.ts`: single discipline score formula (`calculateDisciplineScore`) and 7-dimension evaluator (`evaluateAuditDimensions`), including balanced evaluation of configured per-period credit usage limits (`credit-limit-respected` GREEN vs `credit-limit-exceeded` RED when configured; zero flags when unset)
  - `wishlist.ts`: cash strategy (`INSTANT_EXECUTION` vs `SAVING_REQUIRED`) and 6-month forward installment debt-ratio simulator (`OPTIMAL` $\le 20\%$, `MANAGEABLE` $20\text{–}35\%$, `HIGH_RISK` $> 35\%$)
  - `analytics.ts`: multi-period cashflow aggregation, 100%-conserved 6-bucket category distribution (`LIABILITIES_DEBT`, `DAILY_OPERATIONAL` including manual `DEDUCTION` transactions, `FIXED_ESSENTIALS`, `CORE_SAVINGS`, `SELF_REWARD_SURPLUS`, `BUFFER_POCKET`), 1:1 aligned Donut-to-Table columns (`creditBillsAmount` and `operationalAndFixedOutflow`), P1-to-Vault realization bridge, and deleveraging trajectory milestones (`calculateAnalytics`)
  - `credit-limit.ts`: per-instrument evaluation (`evaluateInstrumentLimit`) and cashflow-bounded safe ceiling calculator (`calculateCreditUsageLimit`)
  - `modular-engine.ts`: standalone modular rules engine evaluating payroll rules, dynamic bucket waterfall allocations across priority tiers, remainder overflow distribution, mid-month budget revision precedence, and synthesis fallback (`evaluateModularEngine`, `synthesizeRulesFromSnapshot`, `getDefaultModularRules`)
- Backend modules (`apps/api/src/`):
  - `snapshots`: `GET /api/snapshots`, `PATCH /api/snapshots/:id`, `POST /api/snapshots/:id/recalculate`, `POST /api/snapshots/:id/close`, `GET /api/snapshots/:id/revisions`, `POST /api/snapshots/:id/revisions`, `POST /api/snapshots/:id/revisions/preview`, and `POST /api/snapshots/:id/resync-rules`
  - `config`: `GET /api/config`, `POST /api/config`, `POST /api/config/sync-to-period`, `POST /api/config/simulate-rules`, and `POST /api/config/restore-defaults`
- Frontend routes (`apps/web/app/`):
  - Phase 0 & 1: Design system primitives (`MetricCard`, `DeltaBadge`, `DataTableRow`, `SidebarNavItem`, `MiniTrendChart`) and `AppShell` (`Sidebar`, `AppHeader`, `MonthYearSwitcher`, `PreBoundaryNotice`)
  - Phase 2 (`/`): Overview dashboard with Newsreader centerpiece Safe-to-Spend Today, Essentials & Operational Baseline card with inline `EditableTarget` (`BudgetRevisionModal` + `BudgetRevisionHistoryPopover`), Waterfall Pillars card, Daily Pacing Engine card, `QuickExpenseForm`, `CashflowSummaryCard`, `RecentTransactionsTable`, `DeficitAlert`, and `ClosePeriodModal` (with interactive Savings Vault Transfer prompt, `P1 Savings Only` / `P1 + Unspent Operational` / `Skip Transfer` presets guarded by `deficitUncovered === 0 && safeUnspentOperational > 0`, and duplicate period transfer warning)
  - Phase 3 (`/payroll`, `/allocations`): Payroll statement receipt table, `PayrollAdjustmentForm` (including `payrollPayoutDate`), `QuickIncomeForm`, SVG `AllocationsDonutChart`, `FixedEssentialsTable`, and 2-priority waterfall execution order card
  - Phase 4 (`/credit`): `CreditUsageLimitPanel` (per-period CC & PayLater usage vs cap, Waterfall-Bounded Optimal & Safe ceilings with binding constraint labels, one-click preset buttons, and inline limit editor with "Also save as Global Default" checkbox), plus 3 URL-driven tabs (`matrix`, `card`, `contracts`) with `LiabilityMatrixTable`, `InlineBulkBillCell` (with live pre-submission PayLater limit guardrail), `CreditCardOverviewCard`, `CreditCardTransactionsTable`, `AddCardChargeForm` (with live pre-submission CC limit & safe headroom guardrail), `DebtFreedomTimeline`, and `CreditContractsTable`
  - Phase 5 (`/savings`, `/ledger`, `/wishlist`, `/audit`):
    - `/savings`: `SavingsBalanceCard`, `SavingsMilestonesCard`, `ManualSavingsForm` (with retroactive "Sweep Unrealized P1 Savings" pre-fill pill bar for already-`LOCKED` periods), `SavingsTransactionsTable`
    - `/ledger`: `LedgerSummaryStrip`, `LedgerClientView` with filtering and `.xlsx` export via `exceljs`
    - `/wishlist`: 2 URL-driven tabs (`planner`, `vault`) with `WishlistSummaryMetrics`, `WishlistPlannerView` (`WishlistPlannerForm`, `WishlistAnalysisResults`), and `WishlistVaultTable` (`ConvertToContractModal`)
    - `/audit`: 5 URL-driven tabs (`scorecard`, `operational`, `rewards`, `debt_burden`, `ledger`) with `AuditScorecardView`, `AuditOperationalView`, `AuditRewardsView`, `AuditDebtBurdenView` (including `Credit Card / Cap` and `PayLater / Cap` columns), and `AuditLedgerView`
  - Phase 6 (`/preferences`): Modular ERP Studio with 4 URL-driven tabs (`?tab=payroll|buckets|sandbox|policy`):
    - Tab 1 (`payroll`): Payroll Formula Builder configuring base salary, working days, daily allowances, laptop allowance, BPJS deductions, and custom bonuses/adjustments with formula modes.
    - Tab 2 (`buckets`): Dynamic Buckets & Priority Tiers studio configuring custom buckets, priority tiers (`ESSENTIAL_UPFRONT`, `SAVINGS_P1`, `SURPLUS_P2`, `CUSTOM_TIER`), formula modes (`FIXED_AMOUNT`, `PERCENT_OF_NET_INCOME`, `PERCENT_OF_DISPOSABLE_AFTER_DEBT`, `DAILY_RATE_TIMES_CYCLE_DAYS`, `REMAINDER_OVERFLOW`), remainder surplus split shares, and "Sync Rules to Current Draft Period".
    - Tab 3 (`sandbox`): Live Interactive Formula Sandbox simulating custom income, working days, credit bills, cycle length, and rule sets in real time.
    - Tab 4 (`policy`): Financial Policy & Risk Governance setting optimal/safe debt ratio ceilings, target savings rates, critical operational floors, and full 11-table database JSON backup and disaster recovery.
  - Phase 7 (`/analytics` & `/reports`):
    - `/analytics`: Multi-period analytics dashboard with URL-driven `AnalyticsScopeToggle` (`?scope=all|locked`), 4 top KPI `MetricCard`s, `CashflowComparisonChart` (grouped SVG bar chart + deleveraging trajectory strip + interactive period inspector), and `CategoryDistributionPanel` (100%-conserved income allocation SVG donut + sub-item breakdown + 1:1 aligned period-by-period cashflow and savings rate ledger).
    - `/reports`: Executive Financial Reports & Plain-Language "Monthly Money Cycle" Hub (`ReportsClientView.tsx`) with 5 URL-driven tabs:
      1. Tab 1 (`statement`): `Monthly Money Cycle` — 5 sequential plain-language steps (*Step 1: Money In*, *Step 2: Debt & Credit Bills*, *Step 3: Monthly Routine Bills*, *Step 4: Daily Living & Food Budget*, *Step 5: Savings & Bottom Line*), PLUS deterministic "Where Your Money Went & Why This Month Changed" driver & spike callout, and actionable "Payday Execution Checklist" transfer & payment guide.
      2. Tab 2 (`comparative`): `Month-to-Month Comparison` — Multi-period financial variance matrix.
      3. Tab 3 (`amortization`): `Debt & Installment Payoff Schedule` — 12-month rolling liability matrix with payoff progress.
      4. Tab 4 (`dossier`): `Budget Edits & Audit History` — Audit trail of target revisions and discipline scorecards.
      5. Tab 5 (`forecast`): `Next 3 Months Forecast` — Rolling 3-month forward liquidity projection with P1 savings squeeze alerts.
      - Full-year 2026–2027 Indonesian National Holidays (SKB 3 Menteri) & attendance cutoff (16th M-1 to 15th M) working-day calculator in `payroll.ts`.
      - Executive `@media print` print styling.
      - 5-sheet formatted `.xlsx` export via `exportExecutiveReportToExcel` in `exportReportsExcel.ts` (`1_Monthly_Money_Cycle`, `2_Month_Comparison`, `3_Debt_Payoff_Schedule`, `4_Budget_Edits_Log`, `5_3Month_Forecast`).
    - `CashReconciliationModal.tsx`: Real Balance Cash Reconciliation ("Cash Opname") modal on `/` Overview and `/ledger`, featuring the Multi-Account Cash Counter calculator, bi-directional surplus resolution (`INCREASE_OPERATIONAL_TARGET` vs `RECORD_INCOME_ADJUSTMENT`), and full in-memory Waterfall + Daily Pacing simulation preview (`POST /api/finance/reconcile-balance/preview` & `POST /api/finance/reconcile-balance`).
  - Phase 8 & Overview Cockpit Overhaul:
    - **Adaptive Balance-Checkpoint, Weighted Weekday/Weekend Runway & 1-Click Routine Quota Engine**:
      - `apps/api/src/calculator/pacing.ts`: Weighted runway with customizable `weekendMultiplier: 1.5`, rolling 7-day runway, calendar-aware weekend day calculation, and fixed essentials routine pool realization.
      - `apps/web/components/overview/AdaptiveDailyPacingCard.tsx`: Newsreader serif `SAFE-TO-SPEND TODAY` centerpiece, Weighted vs Flat rate toggle, 3 runway pills (Weekday, Weekend 1.5x, 7-Day Runway), compact pacing bar, embedded 10-Second Balance Checkpoint with `Includes unspent Routine Bills` checkbox, live Behavioral Spike Detector (`HIGH BURN SPIKE (>2x limit)` with prompt for contextual note, `UPWARD CORRECTION`, `NORMAL BURN`), and collapsible Checkpoint & Burn Audit Trail drawer with 1-click **Undo** (`DELETE /api/finance/transactions/:id`).
      - `apps/web/components/overview/RoutineBillsQuotaCard.tsx`: Segregated active categories (`target > 0`) from zeroed/prepaid categories (`target === 0`), eliminating false "Pool exhausted" displays; 1-click quota tap buttons (`+25k`, `+50k`, `+100k`, `Use Rem`, `Custom`); and compact muted zeroed footer line with inline edit affordance.
      - `apps/web/components/overview/PillarsAndExpenseLoggerCard.tsx`: Stacks Waterfall Pillars (`Savings P1`, `Self-Reward P2`, `Emergency Buffer` with inline `EditableTarget`) and embedded Quick Expense Logger (`Operational Spend`, `Routine Bill`, `Refund / Split`, quick amount pills, description, amount, 1-click submit), eliminating the former Section 2 row.
      - `apps/web/app/page.tsx`: Unified above-the-fold 3-Column Command Cockpit (`AdaptiveDailyPacingCard`, `RoutineBillsQuotaCard`, `PillarsAndExpenseLoggerCard`), zero scrolling needed to log expenses or sync bank balance; Section 2 cleanly dedicated to `Ledger Activity & Cashflow Breakdown`.
      - Backend audit trail: `executeCashReconciliation` records `action: 'BALANCE_CHECKPOINT_SYNCED'` with structured JSON `details` (previous balance, bank balance, routine offset, effective operational cash, variance delta, severity ratio, context note) and elevates severity to `WARNING` on spikes $>2\times$ daily limit.
- Live database (`finance_erp`) state verified (reflecting authorized pre-payday bridging liabilities update for `10/2026`):
  - Contains 6 genuine snapshots (`7/2026` LOCKED, `8/2026` LOCKED, `9/2026` DRAFT, `10/2026` DRAFT, `11/2026` DRAFT, `12/2026` DRAFT).
  - Snapshot `10/2026` reflects updated pre-payday liabilities (`totalDeductions = Rp 4,297,484`, `actualDailyOperational = Rp 1,020,316`, `actualSavings = Rp 288,200`, `remainingBudget = Rp 1,020,316`, `safeToSpendToday = Rp 34,011/day`, `pacingStatus = ON_TRACK`). All other 5 periods remain 100% byte-identical.

---

## In Progress

- None — Steps 0 through 5 are complete and verified.

---

## Next Up

- Ready for production use or user-directed follow-ups.

---

## Locked Decisions

_Decisions that should never be silently revisited by a future session. If you're about to change one of these, stop and confirm with the user first — don't treat "it seemed cleaner this way" as authorization._

- Stack: Next.js (`apps/web`) + NestJS (`apps/api`), two services, one monorepo. Desktop web only — no mobile/responsive layout.
- Live dev DB (`finance_erp` on `127.0.0.1:5433`) holds the owner's real data. Never run `seed`, `migrate reset`, or destructive scripts against `finance_erp`. All automated tests must run against `finance_erp_test` (enforced in `apps/api/test/setup.ts`). V1 DB on port 5440 is read-only historical reference.
- 2-Priority Waterfall (`waterfall.ts`): Fixed essentials + `dailyOperationalTarget` are upfront non-negotiable commitments; Priority 1 is Savings (`actualSavings`); Priority 2 is Self-Reward (`selfReward`, uncapped surplus).
- Payday-to-Payday Consumption Cycle (`pacing.ts`): Period $M$'s consumption cycle runs from period $M$'s `payrollPayoutDate` to $(\text{period } M+1\text{'s } \text{payrollPayoutDate}) - 1\text{ day}$. Modifies only live daily pacing boundaries; stored snapshot waterfall/payroll numbers are 100% invariant.
- Period Lifecycle: `closePeriod` is the ONLY place where `CreditContract.remainingTenor` decrements, and enforces chronological order. `LOCKED` snapshots reject all mutations (transactions, snapshot inputs, budget revisions, liability edits). Wishlist and Savings Vault are independent of snapshot lock status.
- Credit Card obligations come exclusively from `CreditCardTransaction` (via `calculateCardDueAmountForMonth` in `credit.utils.ts`). `MonthlyBulkBill` splits into `BULK_BILL` (`paylaterAmount`) and `PERSONAL_DEBT` (`personalDebtAmount`) transactions upon materialization.
- Discipline Audit inclusion rule: Both `DRAFT` and `LOCKED` snapshots are valid history. A `DRAFT` snapshot is a phantom (excludable) **only** if it has all-default raw inputs, zero budget revisions, zero manual transactions, AND zero materialized liabilities. Never use "LOCKED plus active DRAFT only".
- `INFORMAL_DEBT` audit dimension evaluates `MonthlyBulkBill.personalDebtAmount` strictly (not `MonthlyBulkBill.amount`), as PayLater is already evaluated under `DEBT_BURDEN`.
- Visual direction (`AGENTS.md`): Linear structure, Ramp boldness, Mercury centerpiece serif (`Newsreader` for centerpiece metrics only, `JetBrains Mono` for tabular figures, `Geist` for UI text). Zero emoji, zero icon-in-circle badges, zero raw enum strings, and strict "One Signal Per State".

---

## Known Issues / Open Questions

- **ScheduledBill role in V2**: `ScheduledBill` table exists as pure CRUD with no materialization path in `syncLiabilitiesToSnapshot`.
- **Prisma CLI invocation**: Always run as `npx --no prisma <command>` from inside `apps/api`.
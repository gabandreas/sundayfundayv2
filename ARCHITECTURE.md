# ARCHITECTURE.md — System Design & Data Flow

Detailed breakdown of the data model, calculation pipeline, and state-transition rules for the finance ERP monorepo. This document assumes `AGENTS.md` has already been read.

---

## 1. Domain Model

Same 11 entities as V1, enhanced with rigorous enterprise ERP schema protections:

| Entity | Change from V1 |
|---|---|
| `GlobalConfig` | Adds credit usage caps (`ccUsageLimit`, `paylaterUsageLimit`), payroll payout day (`payrollPayoutDay`), and modular engine JSON fields (`payrollRulesJson`, `allocationBucketsJson`, `surplusSplitRulesJson`, `financialPolicyJson`). |
| `MonthlySnapshot` | Adds `status: DRAFT \| LOCKED`, `payrollPayoutDate`, `isPayoutDateConfirmed`, credit usage caps (`ccUsageLimit`, `paylaterUsageLimit`), `frozenRulesJson`, and `bucketRealizationsJson`. |
| `Transaction` | Adds `sourceType` (`MANUAL`, `BULK_BILL`, `PERSONAL_DEBT`, `CC_TRANSACTION`, `OPERATIONAL_REFUND`), `fixedEssentialCategory` (`TRANSPORT`, `INTERNET`, `VAPE`, `HAIRCUT`), and `bucketKey`. |
| `CreditContract` | Tenor decrement no longer happens as a side effect on read; decrements strictly in `closePeriod`. |
| `ScheduledBill` | Retained as pure reference/CRUD entity. |
| `CreditCardTransaction` | Adds billing cutoff controls, installment tracking (`billingMonth`, `billingYear`, `endedAtMonth`, `endedAtYear`, `chargeType`, `monthlyAmount`, `tenor`, `status`), and early payoff support. |
| `MonthlyBulkBill` | Deconstructed into discrete `paylaterAmount` and `personalDebtAmount` fields with independent transaction materialization. |
| `SavingsManualTransaction` | Adds sub-allocation instrument tagging (`SavingsInstrumentType`: `LIQUID_CASH` vs `INVESTMENT_RDPU`) and deterministic period attribution tag. |
| `WishlistItem` | Adds installment forward planning, financing simulation strategy (`INSTANT_EXECUTION` vs `SAVING_REQUIRED`), and conversion to contract. |
| `BudgetRevision` | Expanded to support all essential categories plus dynamic buckets (`category = CUSTOM_BUCKET`, `bucketKey`, `bucketLabel`), restricted strictly to `DRAFT` snapshots. |
| `AuditLog` | Structured event journal across all mutating services with `AuditSeverity` (`INFO`, `WARNING`, `ADJUSTMENT`, `CRITICAL`). |

The `status: DRAFT | LOCKED` field on `MonthlySnapshot` enforces absolute immutability on closed periods (preventing V1 Bug #2), while JSON configuration and frozen snapshot fields power the modular formula and dynamic bucket engine.

---

## 2. Calculation Pipeline (Single Source of Truth)

All financial math lives in `apps/api/src/calculator/`. Nothing outside this module computes payroll, waterfall allocation, pacing, or debt ratio — every consumer (controllers, other services, the frontend) reads the result, never re-derives it.
calculator/
payroll.ts # adjustedBaseSalary -> netSalaryIncome -> finalTotalIncome
waterfall.ts # finalTotalIncome -> deductions -> priority allocation
pacing.ts # actualDailyOperational -> safeToSpendToday
discipline.ts # single scoring function, used by both summary and full report



### 2.1 Payroll
Unchanged formula from V1 (it was already correct):
adjustedBaseSalary = GlobalConfig.baseSalary + snapshot.salaryAdjustment
bpjsDeduction = round(adjustedBaseSalary * 0.03)
netBasePayroll = adjustedBaseSalary - bpjsDeduction + LAPTOP_ALLOWANCE
totalDailyAllowance = snapshot.totalWorkingDays * GlobalConfig.dailyAllowance
netSalaryIncome = max(netBasePayroll + totalDailyAllowance - snapshot.cafeteriaDeduction, 0)
extraIncome = sum(Transaction.amount WHERE type = INCOME)
finalTotalIncome = netSalaryIncome + snapshot.thrAmount + snapshot.bonusAmount + extraIncome


### 2.2 Deductions — fixes V1 Bug #1 (double-counted installments)
totalDeductions = sum(Transaction.amount WHERE type IN (DEDUCTION, CREDIT_BILL))
That's it — one line, one source. `CreditContract.monthlyInstallment` is **never** summed directly in this calculation. If a contract is active for the period, its materialized `CREDIT_BILL` transaction is the only representation of it that participates in the math. The contract table is bookkeeping (what's owed, how many months left) — it is not a second ledger.

### 2.3 Waterfall — 2-Priority Allocation Structure
Revised from V1's 4-priority structure to an upfront-deducted essentials model with a 2-priority sequence (Savings -> Self-Reward), per explicit user decision:

1. **Upfront Non-Negotiable Commitments**:
   Daily Operational living budget joins Fixed Essentials (transport, internet, vape, haircut) as a non-negotiable living baseline:
   ```
   essentialAndOperational = transport + internet + vape + haircut + dailyOperationalTarget
   availableFunds = finalTotalIncome - essentialAndOperational - bufferPocket - totalDeductions
   ```

2. **Deficit Branch (`availableFunds < 0`)**:
   - `deficitUncovered = Math.abs(availableFunds)`
   - `actualSavings = 0`
   - `selfReward = 0`
   - `actualDailyOperational = 0` (funding fails, even though `dailyOperationalTarget` was the intended allocation)
   - `survivalPocket = essentialAndOperational` (reflects the baseline NEED, not what was funded)

3. **Surplus Branch (`availableFunds >= 0`)**:
   - `actualDailyOperational = dailyOperationalTarget` (guaranteed in full — no longer competes in the waterfall)
   - `deficitUncovered = 0`
   - **Priority 1**: `actualSavings = min(availableFunds, savingsTarget)`
   - **Priority 2**: `selfReward = availableFunds - actualSavings` (uncapped — absorbs baseline self-reward target and any surplus overflow)
   - `survivalPocket = actualDailyOperational + (transport + internet + vape + haircut)`

### 2.4 `totalIncome` on the frontend — fixes V1 Bug #3
The frontend renders `snapshot.totalIncome` as-is. It does not add `windfallPocket` on top, because `windfallPocket` (== `extraIncome`) is already inside `totalIncome`. If a breakdown view wants to show "of which, extra income: X", it displays `windfallPocket` as a sub-line, not an addend.

### 2.5 Discipline score — fixes V1 Bug #4
One function, `discipline.ts`, computes the score from green/red flag counts. Both the summary endpoint and the full audit report call this same function. There is no second formula anywhere.

---

## 3. Period Lifecycle — fixes V1 Bug #2

V1 mutated `CreditContract.remainingTenor` as a side effect of a snapshot being lazily created on GET. This is replaced with an explicit state machine:

DRAFT ──(user reviews payroll, liabilities, waterfall)──> [POST /snapshots/:id/close] ──> LOCKED

- Viewing any month (past, current, or future) only ever reads or creates a `DRAFT` snapshot. Creating a `DRAFT` snapshot copies `GlobalConfig` targets and idempotently materializes due liabilities (see §4 exception), but **never** mutates `CreditContract.remainingTenor` or any persistent contract state.
- `remainingTenor` is decremented **only** inside the `POST /snapshots/:id/close` handler, in a single transaction, and only for the snapshot being closed — never as a byproduct of navigation.
- A `LOCKED` snapshot rejects all mutations (transactions, target edits, budget revisions, and liability adjustments) — absolute immutability is strictly enforced by the status guard.

### 3.2 Consumption Cycle Architecture (Payday-to-Payday)
Superseding the legacy calendar-month model (1st to last day of month M+1), the consumption cycle is variable length and indexed directly to authentic payroll payouts:
- **Cycle Window**: Period M's consumption cycle begins on period M's actual `payrollPayoutDate` and ends on `(period M+1's payrollPayoutDate) - 1 day`.
- **Duration**: `daysInCycle` is variable (e.g. 28 to 33 days) based on the exact payout dates of consecutive periods.
- **Boundary Resolution**:
  - `cycleStartDate`: Sourced from snapshot M's `payrollPayoutDate` (falling back to `GlobalConfig.payrollPayoutDay` applied to month M if unset).
  - `cycleEndDate`: If snapshot M+1 exists and has a confirmed `payrollPayoutDate`, that date is used (`isEndDateConfirmed: true`). If snapshot M+1 does not yet exist or has an unconfirmed default date, it is estimated using `GlobalConfig.payrollPayoutDay` applied to month M+1 (`isEndDateConfirmed: false`).
- **Financial Invariant**: Payout dates and cycle boundaries govern *only* live daily pacing calculations (`safeToSpendToday`, `baselineDailyRate`, `remainingBudget`, `daysRemaining`, `pacingStatus`). Stored snapshot figures (`finalTotalIncome`, `totalDeductions`, `actualDailyOperational`, `actualSavings`, `selfReward`, `deficitUncovered`, `survivalPocket`) are 100% invariant and independent of payout dates.

---

## 4. Data Flow

[Next.js Server Component] ──GET──> [NestJS Controller] ──> [Selector] ──> Prisma (read-only)

[Next.js Form / Server Action] ──POST──> [NestJS Controller] ──> [DTO validation]
──> [Service]
├─> calculator/* (pure functions, no I/O)
└─> Prisma transaction (single write, atomic)


- Selectors never call `calculator/*` with intent to persist — they read what's already computed and stored on the snapshot.
- Services are the only layer allowed to call `calculator/*` and then persist the result.
- Nothing computes and writes in the same step as a GET.
  - **Exception**: `getOrCreateDraftSnapshot` MAY trigger `syncLiabilitiesToSnapshot` and `recalculateSnapshot` as part of first-view provisioning, because both are idempotent and scoped to the single snapshot being created — repeated calls produce identical results and neither touches `CreditContract.remainingTenor` or any state shared across periods. This is fundamentally different from V1 Bug #2 (irreversible cross-period tenor mutation on read) and must never be extended to cover `closePeriod` or any other non-idempotent/cross-period write.

---

## 5. Frontend State

- `?month=` / `?year=` in the URL is the single source of truth for temporal context, read via `useSearchParams` / route params — not duplicated into `useState` and left to drift.
- Server Components fetch per-route; there is no global client cache layer needed for a single-user app navigating sequentially, as long as reads are cheap (they are — single-user, small tables) and mutations trigger a route refresh (`router.refresh()` / revalidation) rather than requiring manual refetch wiring.


---

## 6. Modular Formula & Dynamic Bucket Engine

The modular engine (`apps/api/src/calculator/modular-engine.ts`) abstracts hardcoded payroll line items and waterfall allocations into configuration-driven rules stored in JSON on `GlobalConfig` and frozen per period on `MonthlySnapshot`.

### 6.1 Schema & Data Integrity
1. **Global Master Configuration (`GlobalConfig`)**:
   - `payrollRulesJson`: Configures earnings and deduction rules using 4 formula modes:
     - `FIXED_AMOUNT`: Flat Rp amount (e.g., laptop allowance).
     - `PERCENT_OF_BASE`: Percentage of base salary (e.g., BPJS 3%).
     - `RATE_PER_WORKING_DAY`: Daily allowance multiplied by working days.
     - `PRORATED_MONTHS_OF_BASE`: Prorated fraction of base salary (e.g., December THR).
   - `allocationBucketsJson`: Dynamic allocation buckets defined with:
     - `formulaMode`: `FIXED_AMOUNT`, `PERCENT_OF_NET_INCOME`, `PERCENT_OF_DISPOSABLE_AFTER_DEBT` (evaluated against pure credit bills only, avoiding circular dependency on manual expenses), `DAILY_RATE_TIMES_CYCLE_DAYS`, or `REMAINDER_OVERFLOW`.
     - `priorityTier`: `ESSENTIAL_UPFRONT`, `SAVINGS_P1`, `SURPLUS_P2`, or `CUSTOM_TIER`.
     - `minAmount` / `maxAmount`: Optional clamp boundaries.
   - `surplusSplitRulesJson`: Configures distribution shares (e.g., 50% / 50%) for remainder surplus among overflow buckets.
   - `financialPolicyJson`: Dynamic thresholds for debt ratio ceilings (`optimalDebtRatioPercent`, `maxSafeDebtRatioPercent`), `targetSavingsRatePercent`, and `criticalOperationalFloorRp`.
2. **Snapshot Immutability (`MonthlySnapshot`)**:
   - `frozenRulesJson`: Captures the exact payroll, bucket, and split rules effective when the period was provisioned or last synced. `LOCKED` periods preserve their frozen rules permanently.
   - `bucketRealizationsJson`: Stores detailed per-bucket evaluation outcomes (`targetAmount`, `fundedAmount`, `spentAmount`, `remainingAmount`, `isDeficitSqueezed`).
3. **Transaction & Budget Revision Bridging**:
   - `Transaction.bucketKey`: Optional tag associating manual expenses with a dynamic bucket.
   - `BudgetRevision.bucketKey` & `bucketLabel`: Allows mid-month manual target overrides for dynamic buckets (`category = CUSTOM_BUCKET`).

### 6.2 Precedence & Zero Drift Invariant
- **Budget Revision Precedence**: When a user creates a manual budget revision for an active `DRAFT` period, the revised target takes precedence over the formula-derived baseline during subsequent recalculations until the user explicitly triggers "Sync Rules to Current Draft Period".
- **Legacy Synthesis Fallback**: If an existing historical snapshot has `frozenRulesJson === null`, `synthesizeRulesFromSnapshot(snapshot)` synthesizes rules directly from its stored scalar targets, guaranteeing 100% byte-identical waterfall outcomes (0 Rp drift across historical periods).
- **Pure Credit Bills Invariant**: `PERCENT_OF_DISPOSABLE_AFTER_DEBT` MUST evaluate against pure `CREDIT_BILL` transactions only (`Math.max(0, finalTotalIncome - totalCreditBills) * (percent / 100)`), preventing manual living expenses from shrinking allocation baselines mid-month.


---

## 7. Multi-Tenant Architecture & 4-Tier RBAC

The system employs an account-driven multi-tenant architecture where every core domain record links to an authenticated `User` record (`userId`).

### 7.1 Role-Based Access Control (RBAC)
- **`PLATFORM_OWNER`** (User ID 1): Unrestricted access across the platform, including `/admin` Studio, full database export/import, owner credentials management, and bespoke rule customizations.
- **`BESPOKE_CLIENT`**: Tailored enterprise configuration with custom routine categories, dedicated salary structures, and custom bucket mappings.
- **`STANDARD_MEMBER`**: Generalized commercial edition with standard routine envelopes (`Transport & Fuel`, `Personal Care & Health`, `Internet & Utilities`, `Subscriptions & Lifestyle`).
- **`DEMO_SANDBOX`**: Read-only demo account isolated to synthetic fixtures with write mutation restrictions.

### 7.2 Life-Stage Presets & Configurable Formula Engines
The ERP supports 5 life-stage financial presets across age brackets:
1. `EARLY_CAREER_20S`: Maximizes aggressive emergency funds and skill development buffers.
2. `PRIME_FAMILY_30S_40S`: Accommodates mortgage amortization, child care, and diversified insurance reserves.
3. `PRE_RETIREMENT_50S`: Aggressive debt-clearing and accelerated retirement catch-up.
4. `GOLDEN_YEARS_60S_PLUS`: High-preservation liquid annuity drawdown and medical emergency pools.
5. `SUPERADMIN_BESPOKE`: The platform owner's authentic, personalized priority waterfall.

Supported formula engines:
- **Zero-Sum Priority Waterfall**: Upfront fixed essentials -> Essential debt service -> Priority 1 Core Savings -> Priority 2 Self-Reward/Surplus.
- **50/30/20 Proportional Rule**: 50% Needs, 30% Wants, 20% Savings.
- **6-Jars Proportional System**: Necessities (55%), Long-term Savings (10%), Play (10%), Education (10%), Financial Freedom (10%), Giving (5%).

---

## 8. Security, Rate Limiting & Transactional Restore Engine

### 8.1 Brute-Force Rate Limiter & Reverse Proxy IP Extraction
- **Reverse Proxy IP Resolution**: `extractClientIp(req)` inspects `cf-connecting-ip` -> `x-forwarded-for` (first IP) -> `x-real-ip` -> `req.socket.remoteAddress`, with IPv6 `::ffff:` normalization.
- **Adaptive Rate Limiter**: In-memory rate limiting locks an `(email, clientIp)` tuple for 15 minutes upon 5 consecutive failed authentication attempts, returning `HTTP 429 Too Many Requests`. Successful logins immediately reset the counter.

### 8.2 Transactional Backup & Restore Engine
- **`POST /api/admin/backup/restore`** (Restricted strictly to `PLATFORM_OWNER`):
  - `VALIDATE_DRY_RUN`: Validates payload schema, parses foreign keys, checks record types, and returns exact table row counts without touching the database.
  - `RESTORE_OVERWRITE`: Requires the explicit string `"CONFIRM RESTORE"` and the 6-digit platform security PIN. Executes inside an atomic Prisma `$transaction`: deletes child records first to respect foreign keys, inserts parent and child records in dependency order with restored dates, and automatically resets all PostgreSQL sequences (`setval(pg_get_serial_sequence(...))`) to prevent ID collision on subsequent writes.

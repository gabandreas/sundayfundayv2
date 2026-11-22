# Modular Preferences Studio & Dynamic Navigation

## 1. Persistence Schema (`ModularStudioConfig`)

User-configurable formula parameters, instrument cutoffs, asset reservoirs, routine envelopes, and navigation overrides live inside `GlobalConfig.formulaParamsJson.studioConfig` (`apps/api/src/config/studio.defaults.ts`).

- Default assembly: `buildDefaultStudioConfig` / `resolveStudioConfig` backfill missing nested fields safely when reading older `GlobalConfig` rows.
- Mutation endpoint: `PATCH /api/config/studio` (`ConfigController` -> `ConfigService.updateStudioConfig`), validated through `UpsertGlobalConfigDto`.
- Frontend synchronization: `PerspectiveContext` (`apps/web/context/PerspectiveContext.tsx`) holds live `studioConfig` and exposes `updateStudioConfig`, triggering immediate sidebar and widget updates plus `erp:data-mutated` invalidation without waiting for full SSR reloads.

---

## 2. Six Table-Driven Sub-Modules (`/preferences`)

Implemented across `apps/web/components/preferences/PreferencesStudio.tsx`, `PreferencesNav.tsx`, and `StudioTables.tsx`:

1. **`formula` (`PaycycleFormulaStudioCard`):**
   - Edits Two-Stage Payroll (`payslipAnchorDay`, `payslipShiftRule`, `reviewLagWorkingDays`, `paydayAnchorDay`, `shiftWeekendToFriday`, `periodOverrides`, `holidayDatesIso`), `milestonePriorityOrder`, and the 7 customizable Formula DSL expressions with clickable 31 Reserved Word token chips, `Verify Live` (`POST /api/finance/formula/evaluate`), and `Reset to Default`.
   - Renders a live 6-period Horizon Preview Table showing Stage 1 payslip dates, Stage 2 paydays, living windows (`Payday(M) -> Payday(M+1)-1`), and inline per-month overrides.
2. **`instruments` (`InstrumentsTableCard`):**
   - Edits `InstrumentConfigRow[]`: `id`, `name`, `type` (`PAYLATER` | `CREDIT_CARD` | `CASH_LOAN`), `cutoffDay`, `dueDay`, `dueRule` (`FIXED_DAY` | `DISBURSEMENT_DAY`), `monthlyInterestPct`, `adminFeePct`, `creditLimitRp`, `utilizationWarnPct`, `lateFeeRule`, `active`.
   - Feeds `routeTransactionToPaycycleTs` cutoff logic and utilization alerts across Credit and Reconciler modules.
3. **`accounts` (`AssetAccountsTableCard`):**
   - Master switch **`enableExternalAssetPortfolio`** (default `false` for User #1 ledger-truth mode; `true` for Sandbox). When `OFF`, `Cash & Savings` derives exclusively from verified ledger P1 savings + actual Wallet Check-In cash with zero fabricated external holdings.
   - Edits `AssetAccountConfigRow[]` across `OPERATIONAL_BANK`, `MONEY_MARKET_RDPU`, `TIME_DEPOSIT`, `GOLD`, `STOCKS`, `CRYPTO`, `CASH_WALLET`, `SAVINGS_VAULT`.
4. **`templates` (`RoutineTemplatesTableCard`):**
   - Edits `RoutineTemplateConfigRow[]`: default `slotKey`, `name`, `monthlyQuotaRp`, `targetDueDay`, `rolloverPolicy` (`SWEEP_TO_P1` | `ROLLOVER_NEXT_MONTH`), and `active` (also editable inline from `/allocations?sub=envelopes`).
5. **`navigation` (`SidebarMenuBuilderCard`):**
   - Edits `SidebarNavigationConfig`: `defaultLandingRoute`, `moduleOverrides` (`label`, `hidden`, `order` across all 13 routes), and `customShortcuts` spanning all **13 top-level modules and 22 sub-module destinations** across `FINANCIAL_ENGINE`, `AUDIT_DECISION`, and `SYSTEM`.
6. **`notifications` (`SmtpControlPanel` & `SubscriptionKillSwitchTab`):**
   - SMTP delivery controls, encrypted 16-digit Google App Password persistence, dry-run/live verification, and recurring charge Kill-Switch automation.

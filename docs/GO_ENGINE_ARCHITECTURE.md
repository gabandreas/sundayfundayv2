# Go Engine Architecture (`apps/go-engine` & `GoBridgeService`)

## 1. Overview & Dual-Execution Parity Model

Quantitative analysis, cutoff simulation, waterfall projection, debt payoff comparison, and statement reconciliation execute across two strictly synchronized implementations:

1. **Native Go Engine (`apps/go-engine`):**
   - Pure integer (`int64` IDR) domain calculation packages compiled into `apps/go-engine/bin/go-engine.exe` and `apps/go-engine/bin/erp-engine.exe` via `npm run erp:go:build`.
   - Single-process stdin/stdout JSON CLI dispatcher (`apps/go-engine/cmd/engine/main.go`).
2. **TypeScript Parity Mirror (`apps/api/src/calculator/erp-engines.ts` & `hybrid-engine.ts`):**
   - Exact deterministic TypeScript equivalents (`computePaycycleHorizonTs`, `evaluateConfiguredWaterfallTs`, `routeTransactionToPaycycleTs`, `computeNetWorthTs`, `runForecastTs`, `evaluateAnomaliesTs`, `evaluateEnvelopesTs`, `optimizeDebtPayoffTs`, `computeLifeEnergyTs`, `parseStatementBatchTs`) matching Go rounding (`goRound`, `round1`, `round2`) and IDR formatting (`formatRpId`).
   - Used automatically as the `TS_MIRROR` runtime fallback inside `GoBridgeService` (`apps/api/src/calculator/go-bridge.service.ts`) when executing inside serverless environments (e.g., Vercel Functions) where native binaries are absent.
   - Continuous parity across all engines is enforced in Jest via `apps/api/src/calculator/hybrid-engine.spec.ts`.

---

## 2. Package Inventory (`apps/go-engine/internal/`)

### Analytical & Decision Engines
| Package | Exported Go Functions | TypeScript Mirror Symbol (`erp-engines.ts`) | Responsibility |
| --- | --- | --- | --- |
| `paycycle` | `ComputePaycycleHorizon`, `EvaluateConfiguredWaterfall`, `RouteTransactionToPaycycle` | `computePaycycleHorizonTs`, `evaluateConfiguredWaterfallTs`, `routeTransactionToPaycycleTs` | Payday-to-payday window generation, weekend Friday shifts, configurable waterfall evaluation, instrument cutoff routing |
| `networth` | `ComputeNetWorth` | `computeNetWorthTs` | True Asset Accounts (cash + RDPU) minus unsettled liabilities & multi-month net worth trajectory |
| `forecaster` | `RunForecast` | `runForecastTs` | Baseline vs P2 austerity vs Debt Free-Up 12-month simulation, SPinjam freedom date, pure survival runway |
| `anomaly` | `EvaluateAnomalies` | `evaluateAnomaliesTs` | Cycle spend velocity (`NORMAL` / `CAUTION` / `BURNING_FAST`), post-cutoff creep aggregation, anomaly alert cards |
| `envelopes` | `EvaluateEnvelopes` | `evaluateEnvelopesTs` | Routine envelope rollover (`SWEEP_TO_P1` / `ROLLOVER_NEXT_MONTH`), sinking funds schedule, Age of Money metric |
| `debtopt` | `OptimizeDebtPayoff` | `optimizeDebtPayoffTs` | Avalanche vs Snowball vs Cashflow Unlock strategy comparison and monthly cashflow unlock milestones |
| `lifeenergy` | `ComputeLifeEnergy` | `computeLifeEnergyTs` | Real hourly wage net of workdays, work hours, commute hours, and transport spend (`trueNetHourlyWageRp`) |
| `reconciler` | `ParseStatementBatch` | `parseStatementBatchTs` | Raw bank/e-wallet statement parsing, instrument/category inference, fuzzy deduplication, cutoff auto-routing |

- `reconciler` (`ParseStatementBatch` / `parseStatementBatchTs`): adds `LockedPeriodCodes` + `EarliestOpenMonth/Year` lock-safe routing (`advancedFromLocked`, `originalPeriodCode`) so closed periods never receive new statement writes.
- `formula` (`Evaluate`, `EvaluateSuite` / `evaluateFormulaDslTs`, `evaluateFormulaSuiteTs`): pure recursive-descent arithmetic evaluator supporting 31 `{RESERVED}` tokens and 8 safe functions (`ROUND`, `FLOOR`, `CEIL`, `MIN`, `MAX`, `CLAMP`, `IF`, `PCT`), exposed via `POST /api/finance/formula/evaluate`.

### Legacy / Core Hybrid Packages
- `cutoff` (`SimulateCutoff`, `ComputeSlices`) — Lossless installment splitting and `waitPastCutoff` purchase timing simulation.
- `timeline` (`SimulateTimeline`, `EvaluateWalletGuard`, `BuildCashRadar` / `buildCashRadarTs`) — Cashflow simulation including individual itemized December SPinjam due dates (`PersonalDebtItems`), Wallet Balance Guard delta analysis, and payday-to-payday Cash Radar calendar events with dynamic cutoffs, `H-1` business-day shifts, and **Lowest Cash Point** trough detection (`GET /api/finance/cash-radar`).
- `report` (`BuildExecutiveHorizon`) — Multi-month executive horizon aggregation.
- `doctor` (`RunAudit`) — Zero-drift ledger verification across snapshot history.
- `format` (`Rp`) — Shared integer Rupiah string formatter.

---

## 3. NestJS Bridge & API Endpoints

- `GET /api/finance/intelligence` (`FinanceController` -> `FinanceSelectors.getIntelligenceBundle`):
  - Computes the complete intelligence payload (`paycycle`, `networth` honoring `enableExternalAssetPortfolio`, `forecaster`, `anomaly`, `envelopes` with `ageOfMoney = bufferDays`, `debtopt` excluding internal `P1_VAULT_REFUND`, `lifeenergy`, `dynamicMilestone`, `formulaContext`, and `studioConfig`) without mutating database state.
- `POST /api/finance/formula/evaluate` (`FinanceController.evaluateFormulaSuite` -> `FinanceSelectors.evaluateFormulaSuiteForUser`):
  - Evaluates custom Formula DSL suites against the active period's 31 reserved variables via the Go binary / TS mirror.
- `POST /api/finance/reconciler/parse` (`FinanceController` -> `FinanceSelectors.parseStatementForUser`):
  - Read-only batch parser accepting `ParseReconcilerDto` and returning categorized `ReconcilerParsedRow[]` with deduplication flags, lock-safe advancement, and auto-assigned paycycle target periods.
- `POST /api/finance/reconciler/commit` (`FinanceController` -> `FinanceService.commitReconcilerRows`):
  - Atomic write endpoint (`CommitReconcilerDto`) committing approved statement rows into `Transaction` or `LiabilityLineItem` records and recomputing affected monthly totals, powering the dedicated **`/import`** (*Statement Import*) module.
- `POST /api/finance/scenarios/simulate` (`FinanceController.simulateScenario` -> `FinanceSelectors.simulateScenarioForUser`):
  - Read-only multi-engine What-If simulator running Go `forecaster` + `debtopt` + `cutoff` against user-supplied scenario adjustments (`extraMonthlySavingsRp`, `oneTimeBonusRp`, `monthlyLivingDeltaRp`, `extraDebtPaymentRp`, `variableShockPercent`) to power **`/scenarios`** (*What-If Scenario Lab*) and future mobile clients.

---

## 4. Verification Commands

- Go unit suite: `npm run erp:go:test` (`cd apps/go-engine && go test -v ./...`)
- Binary rebuild: `npm run erp:go:build`
- Go <-> TypeScript parity Jest suite: `cd apps/api && npx jest --no-cache`

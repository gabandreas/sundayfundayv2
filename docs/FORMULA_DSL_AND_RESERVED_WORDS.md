# Formula DSL & Reserved Words Catalog

## 1. Architecture & Dual-Engine Execution

Sunday Funday ERP supports user-customizable financial formulas across 7 core calculations without arbitrary code execution (`eval` or `new Function`).

- **Go Recursive-Descent Engine:** `apps/go-engine/internal/formula/formula.go` (`Evaluate`, `EvaluateSuite`), exposed via `apps/go-engine/cmd/engine/main.go` (`formula-eval` subcommand).
- **TypeScript Parity Mirror:** `apps/api/src/calculator/erp-engines.ts` (`evaluateFormulaDslTs`, `evaluateFormulaSuiteTs`, `RESERVED_WORDS_CATALOG`).
- **Frontend Instant Preview & Editor:** `apps/web/lib/api.ts` (`evaluateFormulaDslClient`, `evaluateFormulaSuiteApi`, `RESERVED_WORDS_CATALOG_LIST`) rendered inside `PaycycleFormulaStudioCard` (`/preferences?sub=formula`).
- **Validation Endpoint:** `POST /api/finance/formula/evaluate` (`FinanceController.evaluateFormulaSuite` -> `FinanceSelectors.evaluateFormulaSuiteForUser`), verified in `apps/api/src/calculator/hybrid-engine.spec.ts`.

---

## 2. Editable Formula Domains (`ModularStudioConfig.paycycleFormulaConfig.formulas`)

| Formula Key | Default Expression | Responsibility |
| --- | --- | --- |
| `takeHomeSalaryFormula` | `{BASE_SALARY} + ({WORK_DAYS} * {DAILY_ALLOWANCE}) + {TRANSPORT_ALLOWANCE} + {FIXED_ADDITIONS} - {TAX_AND_BPJS}` | Monthly net take-home salary before THR |
| `proratedThrFormula` | `ROUND(({TENURE_MONTHS} / 12) * ({BASE_SALARY} + {FIXED_ADDITIONS}))` | Pro-rata religious holiday bonus (THR) |
| `waterfallAllocationFormula` | `MAX(0, {NET_INCOME} - {TOTAL_DEBT} - {ROUTINE_BILLS} - {LIVING_BUDGET})` | Residual distributable surplus for P1/P2 |
| `debtSafeCeilingFormula` | `MAX(0, {NET_INCOME} - {LIVING_BUDGET} - {ROUTINE_BILLS} - {SPINJAM_DEBT} - {OTHER_DEBT})` | Dynamic CC + PayLater safe ceiling (`credit-limit.ts`) |
| `dailySafeToSpendFormula` | `ROUND({LIVING_BUDGET} / MAX(1, {CYCLE_DAYS}))` | Baseline daily allowance over cycle days |
| `trueHourlyWageFormula` | `ROUND(({NET_SALARY} - {ROUTINE_BILLS}) / MAX(1, ({WORK_DAYS_PER_WEEK} * 4) * ({WORK_HOURS_PER_DAY} + {COMMUTE_HOURS_PER_DAY})))` | Real hourly wage factoring in KRL commute time |
| `forecasterFreedDebtToP1Formula` | `ROUND(PCT({TOTAL_DEBT}, 70))` | Sweep share of maturing installments into P1 |

---

## 3. Supported Whitelisted Functions

| Function | Arity | Behavior |
| --- | --- | --- |
| `ROUND(x)` | 1 | Rounds half away from zero to nearest integer Rupiah |
| `FLOOR(x)` | 1 | Floors to largest integer <= `x` |
| `CEIL(x)` | 1 | Ceils to smallest integer >= `x` |
| `MIN(a, b, ...)` | >= 1 | Returns minimum argument |
| `MAX(a, b, ...)` | >= 1 | Returns maximum argument |
| `CLAMP(val, lo, hi)` | 3 | Clamps `val` into `[lo, hi]` |
| `IF(cond, t, f)` | 3 | Returns `t` if `cond != 0` (`>`, `<`, `>=`, `<=`, `==`), else `f` |
| `PCT(base, pct)` | 2 | Computes `(base * pct) / 100` |

Division by zero, unknown `{TOKEN}` names, or unknown function identifiers reject cleanly at validation time with explicit error diagnostics.

---

## 4. 31 Reserved Word Tokens

Tokens are case-normalized uppercase and wrapped in braces `{TOKEN}` (assembled live per snapshot in `FinanceSelectors.buildFormulaVariablesForSnapshot`):

- **Payroll & Income (12):** `BASE_SALARY`, `WORK_DAYS`, `DAILY_ALLOWANCE`, `TRANSPORT_ALLOWANCE`, `FIXED_ADDITIONS`, `GROSS_PAY`, `TAX_AND_BPJS`, `NET_SALARY`, `TENURE_MONTHS`, `THR_MULTIPLIER`, `THR_AMOUNT`, `NET_INCOME`
- **Liabilities & Allocations (10):** `PAYLATER_DEBT`, `CC_DEBT`, `SPINJAM_DEBT`, `OTHER_DEBT`, `TOTAL_DEBT`, `ROUTINE_BILLS`, `LIVING_BUDGET`, `P1_FLOOR`, `P1_SAVINGS`, `P2_REWARD`
- **Paycycle Timing & Work-Cost (9):** `ELAPSED_DAYS`, `CYCLE_DAYS`, `REMAINING_DAYS`, `WEEKEND_WEIGHT`, `WORK_DAYS_PER_WEEK`, `WORK_HOURS_PER_DAY`, `COMMUTE_HOURS_PER_DAY`, `OPTIMAL_DSR_PCT`, `MAX_SAFE_DSR_PCT`

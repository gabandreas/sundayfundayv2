# Paycycle Horizon & Cutoff Routing Law

## 1. Consumption & Bill-Maturity Month Convention (`Payday(M-1) -> Day before Payday(M) = Period M`)

Period `M/YYYY` in Sunday Funday ERP is named after the **consumption and bill-maturity month `M`**, funded by **`Payday(M-1)`** (`computePaydayForMonth(M-1)`):

- **Stage 1 (`payslipDropIso`):** Anchored on `payslipAnchorDay` of month `M-1` (default `25th`), adjusted by `payslipShiftRule` (`SHIFT_PREVIOUS_FRIDAY`, `SHIFT_NEXT_WEEKDAY`, or `EXACT_DAY`) across weekends and holidays (`holidaysIso`).
- **Stage 2 (`paydayIso`):** Advances `reviewLagWorkingDays` working days (`2` working days by default) after `payslipDropIso` in month `M-1` with weekend/holiday shifting, clamped inside calendar month `M-1` via `addWorkingDaysClampedToMonth` (e.g., Feb 25 + 2 working days clamps cleanly inside February to `2027-02-26` so March never opens late). Per-month `periodOverrides` (`payslipDateIso`, `paydayDateIso`) or explicitly confirmed `MonthlySnapshot.payrollPayoutDate` overrides (`isPayoutDateConfirmed = true`, or `10/2026–01/2027`) take precedence when present (`overrideApplied: true`); unconfirmed future snapshots resolve dynamically through the Two-Stage engine (`25th + 2 working days` within `M-1`).
- **Cycle End (`livingEndIso`):** Always the inclusive calendar day immediately preceding `nextPaydayIso` (period `M+1`'s funding payday in month `M`, e.g., `11/2026` runs `2026-10-28` through `2026-11-26` when `12/2026` pays out `2026-11-27`).
- **Consumption Attendance Cutoff:** Period `M` net income computes payroll working days from the funding payday's month (`calculateWorkingDaysForConsumptionPeriod(periodMonth, periodYear)` -> `(M-1, Y')` attendance window `[16th (M-2)..15th (M-1)]`) rather than `(periodMonth, periodYear)`.
- **Due Maturity Horizon (`maturityMonth === periodMonth` / `maturityYear === periodYear`):** Period `M` paycheck (disbursed on `Payday(M-1)`) funds:
  1. Living and routine operational spending from `paydayIso` (`Payday(M-1)`) through `livingEndIso` (`Day before Payday(M)`).
  2. Debt and bill maturities falling due directly in calendar month **`M`**:
     - `OCT '26` (`10/2026`, `28 Sep – 27 Oct 2026`): Pays October maturities (`11, 25 Oct`, Total Debt `Rp 4.082.655`).
     - `NOV '26` (`11/2026`, `28 Oct – 26 Nov 2026`, `ACTIVE` on 22 Nov 2026 at Day 26 of 30): Pays November maturities (`11, 25 Nov`, Total Debt `Rp 4.522.976`).
     - `DEC '26` (`12/2026`, `27 Nov – 27 Dec 2026`, `PRE_PAYDAY` on 22 Nov 2026 at Day 0 of 31, funded by Nov 27 payday + Dec 18 Natal THR `Rp 3.833.425`, Total Net Income `Rp 9.737.425`): Pays December maturities (`11, 17, 23, 24, 25 Dec`, Total Debt `Rp 4.162.341`).
     - `JAN '27` (`01/2027`, `28 Dec 2026 – 26 Jan 2027`, funded by Dec 28 payday `Rp 5.941.000`, THR `Rp 0`): Pays January maturities (`11, 17, 23, 24, 25 Jan`, Total Debt `Rp 3.171.115`).
     - `FEB '27` (`02/2027`, `27 Jan – 25 Feb 2027`, funded by Jan 27 payday): Pays February maturities (Total Debt `Rp 1.967.159`; `11.11` 3x plans and `SPinjam #2/#3` complete `3/3` final slices here).
     - `MAR '27` (`03/2027`, `26 Feb – 28 Mar 2027`, funded by Feb 26 clamped payday): Pays March maturities (Total Debt `Rp 835.996`; SPinjam = `Rp 0`).
     - `APR '27 – SEP '27` (`04/2027..09/2027`): Post-payday debt step-down (`Rp 697.726` in `04/2027` with `2027-04-09` H-1 Friday Permata due shift, then `Rp 293.044/mo` Mandiri KSM through final `48/48` slice in `09/2027`; daily food/living reset cleanly to `Rp 1.500.000/mo`).

---

## 2. Weighted Safe-to-Spend Daily Pacing

`ComputePaycycleHorizon` (`computePaycycleHorizonTs`) calculates live daily operational limits across remaining days (`remainingDays`):

- Weekdays (`Mon–Fri`) carry weight `1.0`.
- Weekend days (`Sat–Sun`) carry configurable multiplier `weekendMultiplier` (default `1.5x`).
- Total remaining weighted units: `remainingWeekdays * 1.0 + remainingWeekends * weekendMultiplier`.
- `weekdaySafeRateRp` equals remaining budget divided by weighted units; `weekendSafeRateRp` equals `weekdaySafeRateRp * weekendMultiplier`. `flatDailyRateRp` provides the unweighted linear comparison.

---

## 3. Payment Instrument Cutoff Routing Rules

`RouteTransactionToPaycycle` (`routeTransactionToPaycycleTs`) routes a transaction dated `txDateIso` (`YYYY-MM-DD`) to its target ERP period based on instrument rules defined in `StudioConfig.instrumentsTable`:

| Instrument | Type | Cutoff Rule | Due Rule | Routing Behavior |
| --- | --- | --- | --- | --- |
| **Shopee SPayLater** | `PAYLATER` | `DAYS_IN_MONTH - 15` (`15th` in 30-day months, `16th` in 31-day months, `13th`/`14th` in Feb) | `FIXED_DAY` (`25th`) | Day `< cutoff` stays in period `M` (due `25th` of `M`); Day `>= cutoff` or `holdPastCutoff` rolls to `M + 1` (due `25th` of `M + 1`) |
| **Permata Credit Card** | `CREDIT_CARD` | `25th` of purchase month (statement closing day) | `FIXED_DAY` (`11th`, shifted `H-1` business day earlier if Sat/Sun) | Day `<= 25` lands in period `M + 1` (due `11th` H-1 of `M + 1`); Day `> 25` (`26th`–month end) lands in `M + 2` (due `11th` H-1 of `M + 2`) |
| **Shopee SPinjam / KSM** | `CASH_LOAN` | Schedule maturity anchor (`11th` / `17th` / `23rd` / `24th` / `25th`) | `DISBURSEMENT_DAY` | Scheduled per explicit installment maturity period (`M`) without cutoff deferral; KSM completes `48/48` in `09/2027` (`Rp 293.044`, final cycle before debt-free `10/2027`) |

---

## 4. Locked Period Immutability Guard

Closed periods (`MonthlySnapshot.status === 'LOCKED'`, e.g., `07/2026`–`10/2026` on User #1) enforce read-only immutability on persisted mutations:

- `FinanceService.evaluateAndPersistWalletGuard` checks `snap.status === 'LOCKED'` when `dto.persist === true` and rejects with `BadRequestException` before writing checkpoints or deficit adjustments.
- `ParseStatementBatch` / `parseStatementBatchTs` receives `lockedPeriodCodes` and `earliestOpenMonth/Year` so statement lines whose natural cutoff maps to a closed period (`10/2026`) automatically advance forward (`advancedFromLocked: true`, `originalPeriodCode: "10/2026"`) to the earliest open period (`11/2026`).
- Non-persisting simulations (`persist: false`) remain permitted for read-only inspection and audit comparison.

# Paycycle Horizon & Cutoff Routing Law

## 1. Two-Stage Corporate Paycycle Window (`Payslip -> Review Lag -> Payday(M)`)

Period `M/YYYY` in Sunday Funday ERP represents a two-stage corporate payroll cycle, not a 1st-to-30th calendar box:

- **Stage 1 (`payslipDropIso`):** Anchored on `payslipAnchorDay` (default `25th`), adjusted by `payslipShiftRule` (`SHIFT_PREVIOUS_FRIDAY`, `SHIFT_NEXT_WEEKDAY`, or `EXACT_DAY`) across weekends and holidays (`holidaysIso`).
- **Stage 2 (`paydayIso`):** Advances `reviewLagWorkingDays` working days (`2` working days by default across accounts) after `payslipDropIso` with weekend/holiday shifting. Per-month `periodOverrides` (`payslipDateIso`, `paydayDateIso`) or explicitly confirmed `MonthlySnapshot.payrollPayoutDate` overrides (`isPayoutDateConfirmed = true`, or `10/2026–12/2026`) take precedence when present (`overrideApplied: true`); unconfirmed future snapshots resolve dynamically through the Two-Stage engine (`25th + 2 working days = 27th/28th`).
- **Cycle End (`livingEndIso`):** Always the calendar day immediately preceding `nextPaydayIso` (period `M+1`'s payday).
- **Due Maturity Horizon (`maturityMonth` / `maturityYear`):** Period `M` paycheck funds:
  1. Living and routine operational spending from `paydayIso` through `livingEndIso`.
  2. Debt and bill maturities falling due in calendar month **`M + 1`**:
     - `OCT '26` (`10/2026`): Pays November maturities (`11 Nov` CC, `25 Nov` PayLater).
     - `NOV '26` (`11/2026`): Pays December maturities (`8, 11, 17, 18, 23, 24, 25 Dec` SPinjam, `11 Dec` CC, `25 Dec` PayLater).
     - `DEC '26` (`12/2026`): Pays January maturities (`11 Jan` CC, `25 Jan` PayLater).

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
| **Shopee SPayLater** | `PAYLATER` | `15th` of purchase month | `FIXED_DAY` (`25th`) | Day `<= 15` bills in current period `M` (due `M+1` 25th); Day `> 15` crosses cutoff and defers to `M + 1` (due `M+2` 25th) |
| **BCA Credit Card** | `CREDIT_CARD` | `20th` of purchase month | `FIXED_DAY` (`11th`) | Day `<= 20` lands in `M`; Day `> 20` defers to `M + 1` |
| **Shopee SPinjam** | `CASH_LOAN` | `8th` schedule anchor | `DISBURSEMENT_DAY` | Scheduled per explicit installment maturity period without cutoff deferral |

---

## 4. Locked Period Immutability Guard

Closed periods (`MonthlySnapshot.status === 'LOCKED'`, e.g., `07/2026`–`10/2026` on User #1) enforce read-only immutability on persisted mutations:

- `FinanceService.evaluateAndPersistWalletGuard` checks `snap.status === 'LOCKED'` when `dto.persist === true` and rejects with `BadRequestException` before writing checkpoints or deficit adjustments.
- `ParseStatementBatch` / `parseStatementBatchTs` receives `lockedPeriodCodes` and `earliestOpenMonth/Year` so statement lines whose natural cutoff maps to a closed period (`10/2026`) automatically advance forward (`advancedFromLocked: true`, `originalPeriodCode: "10/2026"`) to the earliest open period (`11/2026`).
- Non-persisting simulations (`persist: false`) remain permitted for read-only inspection and audit comparison.

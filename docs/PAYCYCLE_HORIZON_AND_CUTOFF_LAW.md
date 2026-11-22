# Paycycle Horizon & Cutoff Routing Law

## 1. Consumption & Bill-Maturity Month Convention (`Payday(M-1) -> Day before Payday(M) = Period M`)

Period `M/YYYY` in Sunday Funday ERP is named after the **consumption and bill-maturity month `M`**, funded by **`Payday(M-1)`** (`computePaydayForMonth(M-1)`):

- **Stage 1 (`payslipDropIso`):** Anchored on `payslipAnchorDay` of month `M-1` (default `25th`), adjusted by `payslipShiftRule` (`SHIFT_PREVIOUS_FRIDAY`, `SHIFT_NEXT_WEEKDAY`, or `EXACT_DAY`) across weekends and holidays (`holidaysIso`).
- **Stage 2 (`paydayIso`):** Advances `reviewLagWorkingDays` working days (`2` working days by default) after `payslipDropIso` in month `M-1` with weekend/holiday shifting. Per-month `periodOverrides` (`payslipDateIso`, `paydayDateIso`) or explicitly confirmed `MonthlySnapshot.payrollPayoutDate` overrides (`isPayoutDateConfirmed = true`, or `10/2026–01/2027`) take precedence when present (`overrideApplied: true`); unconfirmed future snapshots resolve dynamically through the Two-Stage engine (`25th + 2 working days = 27th/28th`).
- **Cycle End (`livingEndIso`):** Always the calendar day immediately preceding `nextPaydayIso` (period `M+1`'s funding payday in month `M`).
- **Due Maturity Horizon (`maturityMonth === periodMonth` / `maturityYear === periodYear`):** Period `M` paycheck (disbursed on `Payday(M-1)`) funds:
  1. Living and routine operational spending from `paydayIso` (`Payday(M-1)`) through `livingEndIso` (`Day before Payday(M)`).
  2. Debt and bill maturities falling due directly in calendar month **`M`**:
     - `OCT '26` (`10/2026`, `28 Sep – 27 Oct 2026`): Pays October maturities (`8, 11, 25 Oct`, Total Debt `Rp 4.082.655`).
     - `NOV '26` (`11/2026`, `28 Oct – 26 Nov 2026`, `ACTIVE` on 22 Nov 2026 at Day 26 of 30): Pays November maturities (`8, 11, 25 Nov`, Total Debt `Rp 4.522.976`).
     - `DEC '26` (`12/2026`, `27 Nov – 27 Dec 2026`, `PRE_PAYDAY` on 22 Nov 2026 at Day 0 of 31): Pays December maturities (`8, 11, 17, 23, 24, 25 Dec`, Total Debt `Rp 4.187.341`).
     - `JAN '27` (`01/2027`, `28 Dec 2026 – 26 Jan 2027`, funded by Dec 28 payday + Natal THR `Rp 9.840.917`): Pays January maturities (`8, 11, 17, 23, 24, 25 Jan`, Total Debt `Rp 3.171.115`).
     - `FEB '27` (`02/2027`, `27 Jan – 24 Feb 2027`): Pays February maturities (Total Debt `Rp 1.967.159`; `11.11` 3x plans and `SPinjam #2/#3` finish here).
     - `MAR '27` (`03/2027`, `25 Feb – 25 Mar 2027`): Pays March maturities (Total Debt `Rp 835.996`; SPinjam = `Rp 0`).

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
| **Shopee SPayLater** | `PAYLATER` | `24th` of purchase month (or configured `cutoffDay`) | `FIXED_DAY` (`8th`) | Day `<= cutoff` bills in period `M + 1` (due `M + 1` due day); Day `> cutoff` crosses cutoff and defers to `M + 2` (due `M + 2` due day) |
| **BCA Credit Card** | `CREDIT_CARD` | `27th` of purchase month (or configured `cutoffDay`) | `FIXED_DAY` (`25th`) | Day `<= cutoff` lands in period `M + 1`; Day `> cutoff` defers to `M + 2` |
| **Shopee SPinjam** | `CASH_LOAN` | `8th` schedule anchor | `DISBURSEMENT_DAY` | Scheduled per explicit installment maturity period (`M`) without cutoff deferral |

---

## 4. Locked Period Immutability Guard

Closed periods (`MonthlySnapshot.status === 'LOCKED'`, e.g., `07/2026`–`10/2026` on User #1) enforce read-only immutability on persisted mutations:

- `FinanceService.evaluateAndPersistWalletGuard` checks `snap.status === 'LOCKED'` when `dto.persist === true` and rejects with `BadRequestException` before writing checkpoints or deficit adjustments.
- `ParseStatementBatch` / `parseStatementBatchTs` receives `lockedPeriodCodes` and `earliestOpenMonth/Year` so statement lines whose natural cutoff maps to a closed period (`10/2026`) automatically advance forward (`advancedFromLocked: true`, `originalPeriodCode: "10/2026"`) to the earliest open period (`11/2026`).
- Non-persisting simulations (`persist: false`) remain permitted for read-only inspection and audit comparison.

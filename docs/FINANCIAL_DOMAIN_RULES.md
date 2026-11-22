# Financial Domain Rules

Authoritative accounting and cutoff specifications for Sunday Funday ERP.

## 1. Consumption & Bill-Maturity Month Convention (`Period M`)

- Period `M/YYYY` (e.g., `11/2026` / `NOV '26`) is funded by the late-`M-1` paycheck (`Payday(M-1)`, e.g., `28 Oct` for `11/2026`) and spans until the day before period `M+1`'s `payrollPayoutDate` (`Day before Payday(M)`, e.g., `26 Nov` for `11/2026`).
- Consequently, period `M` cashflow pays bills falling due directly in calendar month **`M`** (`maturityMonth === periodMonth`, `dueMonth === periodMonth`):
  - `OCT '26` (`10/2026`, `28 Sep - 27 Oct 2026`): Pays October due dates (`11, 25 Oct`).
  - `NOV '26` (`11/2026`, `28 Oct - 26 Nov 2026`, `ACTIVE` on 22 Nov 2026 at Day 26 of 30): Pays November due dates (`11, 25 Nov`).
  - `DEC '26` (`12/2026`, `27 Nov - 27 Dec 2026`, `PRE_PAYDAY` on 22 Nov 2026 at Day 0 of 31): Pays December due dates (`11, 17, 23, 24, 25 Dec`).
  - `JAN '27` (`01/2027`, `28 Dec 2026 - 26 Jan 2027`, funded by Dec 28 payday + Natal THR): Pays January due dates (`11, 17, 23, 24, 25 Jan`).
  - `FEB '27 – SEP '27` (`02/2027..09/2027`): Post-2026 horizon with `Rp 1.500.000/mo` baseline daily ops; `FEB '27` retires `11.11` & `SPinjam #2/#3` (`3/3`), `04/2027` shifts Sunday Apr 11 Permata CC due date H-1 to `2027-04-09`, and `09/2027` retires `48/48` Mandiri KSM (`Rp 293.044`).

## 2. Cutoff Routing Rules

- **SPayLater (Due 25th, Dynamic Cutoff `daysInMonth - 15` — 15th in 30-day months, 16th in 31-day months):**
  - Order completed on `day <= cutoff` (and `holdPastCutoff = false`) bills in the **next billing period `purchaseMonth + 1`** (due on the 25th of `purchaseMonth + 1`, e.g., Oct 2026 purchases `<= 16 Oct` due `25 Nov 2026`).
  - Order completed on `day > cutoff` OR held past cutoff (`holdPastCutoff = true`) defers to **`purchaseMonth + 2`**.
  - Splitting a partial payment in `MatrixCellDrawer` cleanly divides a single `LiabilityLineItem` across the cutoff boundary.
- **Permata Credit Card (Due 11th + H-1 Business-Day Shift, Fixed Statement Cutoff 25th):**
  - Transactions dated `<= 25th` land in billing period `purchaseMonth + 1` (due on the 11th of `purchaseMonth + 1`, shifted **H-1 business day earlier** to Friday if the 11th falls on Sat/Sun — e.g., Sunday `2027-04-11` -> Friday `2027-04-09`).
  - Transactions dated `> 25th` (`26th`–end of month, including Nov 26–30) close on the 25th of `purchaseMonth + 1` and fall due on the 11th of **`purchaseMonth + 2`** (`> 25 Nov` -> `11 Jan 2027`, cycle `01/2027`).
- **Personal & Informal Debt (`SPinjam`, Peer, P1 Vault Refunds):**
  - Scheduled explicitly per repayment due cycle (`M`). Early full payoff (`accelerateBridgeLoan`) consolidates all remaining unsettled slices of a `parentContractId` into a chosen target month and triggers recalculation.

## 3. Two-Priority Waterfall, Proportional Living Cash Law & Override Locks

- Fixed essentials (Routine Bills: `TRANSPORT`, `INTERNET`, `VAPE`, `HAIRCUT`, plus active `CREDIT_BILL` liabilities) are funded upfront alongside `dailyOperational`.
- **Proportional Living Cash Law:** Remaining cashflow after external debt (`totalDeductions`) and Routine Bills funds `dailyOperational` proportionally rather than dropping to `Rp 0` on partial shortfall:
  - `AvailableForLiving = max(0, FinalTotalIncome - TotalDeductions - RoutineBills)`
  - `FundedLivingCash (actualDailyOperational) = min(PlannedDailyOperationalTarget, AvailableForLiving)`
  - `BufferFunded = min(BufferTarget, max(0, AvailableForLiving - FundedLivingCash))`
  - `DeficitUncovered = PlannedTotalMandatoryNeed - (TotalDeductions + RoutineBills + FundedLivingCash + BufferFunded)` when `FinalTotalIncome < PlannedTotalMandatoryNeed`
  - Consequently, whenever `AvailableForLiving > 0`, `Safe-to-Spend Today` remains positive (`> Rp 0`), P1/P2 allocate `Rp 0` during a shortfall, and `Budget Shortfall` equals `PlannedLiving - FundedLivingCash` (plus any unfunded buffer).
- **Cash & Shortfall Conservation Identities (`0 Rp` Drift):**
  - Eq 1 (when `FinalTotalIncome >= TotalDeductions + RoutineBills`): `FinalTotalIncome == TotalDeductions + RoutineBills + BufferFunded + FundedLivingCash + ActualSavingsP1 + SelfRewardP2`.
  - Eq 2 (when `DeficitUncovered > 0`): `FinalTotalIncome + DeficitUncovered == TotalDeductions + RoutineBills + BufferTarget + PlannedDailyOperationalTarget + ActualSavingsP1 + SelfRewardP2`.
- **Override Locks:**
  - `isManualOverride = true` with `lockedP1` / `lockedP2` preserves explicit user overrides across recalculations (e.g., `10/2026` `P1 = Rp 256.341` before P1 borrow = `Rp 6.341`).
  - `oneOffBillsJson` overrides a routine slot display label only for that cycle without polluting the global routine template or subsequent months.

## 4. Zero Double-Counting Invariant & Strict Period Scoping

- `MonthlyBulkBill.paylaterAmount` MUST always equal the sum of `LiabilityLineItem` rows with `category = PAYLATER` for `(userId, month, year)`.
- `MonthlyBulkBill.personalDebtAmount` MUST always equal the sum of `LiabilityLineItem` rows with `category IN ('PERSONAL_DEBT', 'P1_VAULT_REFUND')` for `(userId, month, year)`.
- Matrix `contractRows` / `activeInstallmentPlans` (`isIncludedInMatrixRows: true`) contain **strictly multi-month installment plans (`totalTenor > 1` and `category != 'P1_VAULT_REFUND'`)** with `M+1` true final maturity dates, never added a second time into `totalsPerMonth` or `MonthlySnapshot.totalDeductions`.
- Single-period charges (`1/1`, including `Hoodie P1 Vault Forward-Borrow Refund (Rp 250.000)` strictly in `01/2027` and `Billiard, Beer & Indomaret (Rp 170.000)` strictly in `12/2026`, plus recurring CC items) are scoped exclusively to their exact billing period and never appear in expired or future cycles.
- Net Worth Debt Principal sums **Current Cycle External Debt Due** (excluding internal `P1_VAULT_REFUND`) plus **Future Unpaid Multi-Month Installment Principal** (excluding future unincurred recurring CC subscriptions and internal vault refunds).

## 5. Ledger Epoch Isolation & P1 Vault Truth

- Active analytical/savings aggregations (`ledgerEpochMonth = 10, ledgerEpochYear = 2026`) exclude synthetic pre-October `06/2026–09/2026` seed backfill so User #1's closed-cycle Core Savings P1 derives solely from verified `SavingsManualTransaction` records (or explicit `actualP1VaultBalanceRp` override).

## 6. Five-Layer Verification Suite (`scripts/erp-bug-bounty.ts`)

- **Layer 1 (Go Adversarial Fuzz & Go-TS Parity):** Runs `go test -v ./...` across all 13 Go packages (including 620+ adversarial fuzz vectors in `adversarial_fuzz_test.go`) and 60 randomized Go binary vs TS mirror parity checks (`paycycle-waterfall`, `cutoff-simulate`, `formula-eval`).
- **Layer 2 (Demo Sandbox Mutation Fuzzing & Cross-Tenant Isolation):** Authenticates strictly as Demo Sandbox (`userId = 2`), executes write mutations across every API flow (including locked-period write rejection and Partial Living Cash stress) asserting Conservation Equations 1–4 after every write, verifies cross-tenant IDOR rejection (`403`/`404`) against User #1 IDs, and resets Sandbox cleanly.
- **Layer 3 (User #1 Read-Only Cross-Route Parity):** Reads all routes and sub-modules for `userId = 1` across `10/2026–02/2027` asserting exact numerical parity, zero ghost contracts, and zero fabricated asset yields.
- **Layers 4 & 5 (Live Browser & Security/Email Suites):** Pair with headless browser click-through, `scripts/erp-pentest.ts --live`, and `scripts/erp-email-e2e.ts --live`.

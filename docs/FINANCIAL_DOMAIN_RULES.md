# Financial Domain Rules

Authoritative accounting and cutoff specifications for Sunday Funday ERP.

## 1. Payday-to-Bill Cycle Convention

- Period `M/YYYY` (e.g., `11/2026` / `NOV '26`) is funded by the late-`M` paycheck (`~27 Nov`) and spans until the day before period `M+1`'s `payrollPayoutDate` (`~27 Dec`).
- Consequently, period `M` cashflow pays bills falling due in **`M + 1`**:
  - `OCT '26` (`28 Oct - 26 Nov 2026`): Pays November due dates (`11 Nov` CC, `25 Nov` PayLater).
  - `NOV '26` (`27 Nov - 27 Dec 2026`): Pays December due dates (`8 Dec` SPinjam, `11 Dec` CC, `25 Dec` PayLater).
  - `DEC '26` (`28 Dec - 26 Jan 2027`): Pays January due dates (`11 Jan` CC, `25 Jan` PayLater).

## 2. Cutoff Routing Rules

- **SPayLater (Due 25th, Cutoff 15th):**
  - Order completed on `day <= 15` (and `holdPastCutoff = false`) bills in the **current purchase month** (due 25th of the following calendar month -> ERP period = `purchaseMonth`).
  - Order completed on `day > 15` OR held past cutoff (`holdPastCutoff = true`) defers to **`purchaseMonth + 1`**.
  - Splitting a partial payment in `MatrixCellDrawer` cleanly divides a single `LiabilityLineItem` across the cutoff boundary.
- **Credit Card (Due 11th, Cutoff 20th):**
  - Transactions dated `<= 20th` land on that billing month; transactions `> 20th` roll into the next billing cycle.
- **Personal & Informal Debt (`SPinjam`, Peer, P1 Vault Refunds):**
  - Scheduled explicitly per repayment due cycle. Early full payoff (`accelerateBridgeLoan`) consolidates all remaining unsettled slices of a `parentContractId` into a chosen target month and triggers recalculation.

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
- Single-period charges (`1/1`, including `Hoodie P1 Vault Forward-Borrow Refund (Rp 250.000)` strictly in `12/2026` and recurring CC items) are scoped exclusively to their exact billing period and never appear in expired or future cycles.
- Net Worth Debt Principal sums **Current Cycle External Debt Due** (excluding internal `P1_VAULT_REFUND`) plus **Future Unpaid Multi-Month Installment Principal** (excluding future unincurred recurring CC subscriptions and internal vault refunds).

## 5. Ledger Epoch Isolation & P1 Vault Truth

- Active analytical/savings aggregations (`ledgerEpochMonth = 10, ledgerEpochYear = 2026`) exclude synthetic pre-October `06/2026–09/2026` seed backfill so User #1's closed-cycle Core Savings P1 derives solely from verified `SavingsManualTransaction` records (or explicit `actualP1VaultBalanceRp` override).

## 6. Five-Layer Verification Suite (`scripts/erp-bug-bounty.ts`)

- **Layer 1 (Go Adversarial Fuzz & Go-TS Parity):** Runs `go test -v ./...` across all 13 Go packages (including 620+ adversarial fuzz vectors in `adversarial_fuzz_test.go`) and 60 randomized Go binary vs TS mirror parity checks (`paycycle-waterfall`, `cutoff-simulate`, `formula-eval`).
- **Layer 2 (Demo Sandbox Mutation Fuzzing & Cross-Tenant Isolation):** Authenticates strictly as Demo Sandbox (`userId = 2`), executes write mutations across every API flow (including locked-period write rejection and Partial Living Cash stress) asserting Conservation Equations 1–4 after every write, verifies cross-tenant IDOR rejection (`403`/`404`) against User #1 IDs, and resets Sandbox cleanly.
- **Layer 3 (User #1 Read-Only Cross-Route Parity):** Reads all routes and sub-modules for `userId = 1` across `10/2026–02/2027` asserting exact numerical parity, zero ghost contracts, and zero fabricated asset yields.
- **Layers 4 & 5 (Live Browser & Security/Email Suites):** Pair with headless browser click-through, `scripts/erp-pentest.ts --live`, and `scripts/erp-email-e2e.ts --live`.

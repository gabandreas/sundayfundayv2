# Product Requirements Document (PRD) — Sunday Funday ERP V2.5

## 1. Executive Summary & Scope

Sunday Funday ERP is a deterministic, single-user desktop personal finance ERP engineered around Indonesian payroll cutoffs, multi-instrument credit billing horizons, and an authentic payday-to-payday consumption cycle.

- **Surface:** Desktop web application (`apps/web` Next.js 16 App Router + `apps/api` NestJS 11 + `apps/go-engine` native Go 13-package financial math engine).
- **Primary Consumer Account:** User #1 (`Gabriel` / `cheeseburger`, `userId = 1`), operating under consumer role `USER` with `SUPERADMIN_BESPOKE` blueprint protection.
- **Evaluation Sandbox:** User #2 (`guest` / `demo@sundayfunday.id`, `userId = 2`), isolated under `DEMO_SANDBOX` with one-click reset.
- **System Administration:** Dedicated `superadmin` account (`role = SUPERADMIN`) strictly isolated from consumer financial workspaces.

---

## 2. Core Financial Domain Invariants

1. **Consumption & Bill-Maturity Month Convention (`Payday(M-1) -> Day before Payday(M) = Period M`):**
   - Period `M/YYYY` is funded by `Payday(M-1)` (~25th–28th of Month `M-1`) and runs through the day before `Payday(M)`.
   - Period `M` cashflow funds all living operational expenses across `[Payday(M-1), Payday(M)-1]` and all credit and debt obligations whose due dates fall directly inside Month `M` (`Permata CC` & `SPinjam` due `11th` H-1 / `17th`/`23rd`/`24th`/`25th`, `SPayLater` & `Mandiri KSM` due `25th`).
2. **Upfront Ringfencing & 2-Priority Waterfall:**
   - **Upfront Essentials:** Materialized debt (`PayLater + Credit Card + Personal Debt`), fixed routine quotas (`Transport`, `Internet`, `Vape`, `Haircut`), and `Daily Operational Living` are ringfenced upfront.
   - **Budget Shortfall:** When upfront essentials exceed `finalTotalIncome`, `actualDailyOperational` is clamped to remaining positive cashflow and the exact deficit is recorded in `deficitUncovered` (`P1 = Rp 0`, `P2 = Rp 0`).
   - **Surplus Waterfall:** Positive surplus funds **Priority 1 (`Core Savings / P1`)** up to target, then spills into **Priority 2 (`Self-Reward & Buffer / P2`)**.
3. **3-State Daily Pacing Engine (`PRE_PAYDAY` | `ACTIVE` | `COMPLETED`):**
   - `PRE_PAYDAY`: Reference date precedes `cycleStartDate`; reports `daysPassed = 0`, `currentDayIndex = 0`, `daysUntilCycleStart > 0`, projected daily rate, and a Pre-Payday Bridge Callout without falsely penalizing burn pace.
   - `ACTIVE`: Reference date falls inside `[cycleStartDate, cycleEndDate]`; computes live `safeToSpendToday`, weekday/weekend weighted rates, and `paceDeltaRp`.
   - `COMPLETED`: Reference date exceeds `cycleEndDate`; freezes `safeToSpendToday = 0` and `daysRemaining = 0`.
4. **Smart Default Active Period (`GET /api/snapshots/default-period`):**
   - Configurable per user (`EARLIEST_OPEN_ACTIVE` default vs `CALENDAR_WINDOW`).
   - Automatically skips `LOCKED` historical snapshots so post-close users land directly on their next active `DRAFT` period.

---

## 3. Functional Modules & Consolidated Information Architecture

| Section | Route | Purpose & Key Capabilities |
| :--- | :--- | :--- |
| **Overview** | `/` | 3-state Daily Pacing cockpit, Wallet Reconciliation & Check-In Guard, Routine Bills Quota progress, P1/P2 status, Quick Expense Recorder, and Period Transaction Ledger. |
| **Payday & Closing Wizard** | `/payday-wizard` | Guided 4-step monthly ritual: (1) Confirm Paycheck & Working Days, (2) Lock Prior Cycle, (3) Settle Due-Date Bills, (4) Activate Living Pool & Confirm P1 Deposit. |
| **Cash Radar & Calendar** | `/calendar` | Authoritative Go/TS `Cash Radar` (`radar.go` / `/api/finance/cash-radar`) Mon–Sun payday-to-payday grid plotting Payday Inflows, Dynamic Cutoff Dates (`daysInMonth - 15` SPayLater, `25th` Permata CC), `H-1` business-day due dates (`11th`/`25th`), synced SVG curve, Day Inspector, and **Lowest Cash Point** trough balance. |
| **Payroll & Income** | `/payroll` | Attendance working-day cutoff (16th M-2 to 15th M-1 feeding Period `M` via `calculateWorkingDaysForConsumptionPeriod`), BPJS deduction, THR/bonus calculator, Split-Bill Timeline, and True Net Hourly Wage calculator. |
| **Allocations** | `/allocations` | Interactive Waterfall & Living Quota Planner, Envelope Rollover (`SWEEP_TO_P1` vs `ROLLOVER_NEXT_MONTH`) & Sinking Fund amortization, and append-only Budget Revisions Log. |
| **Credit & Liabilities** | `/credit` | `?sub=matrix` (12-Month Rolling Debt Matrix), `?sub=contracts` (5-tier `ActiveContractsHub` with SPinjam-first priority & Snowball vs Avalanche optimizer), `?sub=simulator` (Cutoff Advisor + embedded Wishlist Affordability Vault), `?sub=reconciler` (Bulk Statement Parser). |
| **Savings & Vaults** | `/savings` | Cash vs Debt Net Worth comparison, 12-Month 3-Scenario Wealth Forecaster, and P1 Vault & Forward-Borrow Ledger. |
| **Spending & Trend Review** | `/analytics` | Multi-period spending structure, category trend velocity, and cycle-over-cycle consumption review (`AUDIT & DECISION` Sidebar slot). |
| **Marquee AI Co-Pilot** | Icon-Only Bottom-Right Launcher + `Alt+M` + `/marquee` | 3-tier context-hydrated Financial AI Co-Pilot & Quick-Capture (`Tier 1` trilingual NLU fallback, `Tier 2` two-turn tool-calling & Markdown synthesis via DeepSeek V4.1 Flash `deepseek-flash`, OpenCode Zen `deepseek-v4.1-flash-free`, `gemini-3.8-flash`, or Groq `llama-3.3-70b-versatile`, `Tier 3` `X-Marquee-Token` webhook). |
| **Reports & Statements** | `/reports` | `?sub=executive` (Closing Statement), `?sub=variance` (MoM Variance + Go Telemetry Strip), `?sub=audit` (Discipline Scorecard + Mid-Month Edits Log), `?sub=export` (4-Sheet `.xlsx` & SMTP Gmail dispatch). |
| **Subscriptions** | `/subscriptions` | Recurring card charges, promo-expiry kill-switch alerts, and cancellation tracking. |
| **Preferences** | `/preferences` | Formula DSL Studio, Instruments & Cutoffs, Asset Accounts, Routine Templates, Navigation Builder, SMTP & Security Guard, and `?sub=ai` (Marquee BYOK AES-256-GCM & Webhook Token Manager). |
| **Platform Admin** | `/admin` & `/admin/sql` | Strictly restricted to `role === 'SUPERADMIN'`. Multi-tenant management, backup/restore, IP whitelist, and SQL Studio. |

---

## 4. Non-Functional & Quality Requirements

- **Zero Engine Drift:** 100% parity between `apps/go-engine` and `apps/api/src/calculator` verified across 620+ adversarial fuzz vectors and live snapshot audits (`0 Rp` discrepancy).
- **Read-Path Immutability:** No `GET` route or Server Component data fetch may mutate persistent state.
- **Role & Tenant Isolation:** `PlatformOwnerGuard` enforces `user.role === 'SUPERADMIN'`; IDOR checks scope every query and mutation strictly to the authenticated `userId`.
- **Trilingual Localization (`EN` / `ID` / `ZH`):** Full dictionary and phrase coverage with zero untranslated raw keys.

# Sub-Module Architecture, Ultrawide Layout & Copy Standards

## 1. Unified Overview vs Expandable Sidebar Sub-Modules

- **Overview (`/`) stays single-surface:** `OverviewClientView.tsx` renders one continuous vertical workspace (`OverviewExecutiveRibbon` -> 3-column Core Bento Grid -> `OverviewIntelligenceStrip` -> `RecentTransactionsTable`) with **zero sidebar sub-modules**.
- **`RecordExpenseCard.tsx` Work-Hours Badge:** Displays live equivalent work-hours cost derived from the active period's `lifeenergy.trueNetHourlyWageRp` as amounts are entered.
- **Consolidated 8-Hub Navigation IA (Phase 3 / V3.0, with Zero-404 Legacy Redirects):**
  - **`/` (*Overview*):** Single-surface cockpit plus conditional `Active Event Budget` banner and One-Off Commitments inside `BillSettlementChecklistCard`.
  - **`/calendar` (*Cashflow & Ledger*):** `calendar` (default: Cash Calendar with `COMMITMENT` filter + inline Day Inspector actions), `ledger` (`CalendarLedgerEmbed`), `import` (`StatementImportClient`).
  - **`/payroll` (*Income & Payday*):** `payslip` (default), `closing` (Payday & Closing wizard cleanly embedded via `PaydayClosingEmbed`; duplicate `PaydayTimelineSimulator` removed), `lifeenergy` (True Hourly Wage).
  - **`/credit` (*Bills & Credit*):** `matrix` (default: Bill Schedule & Cards), `commitments` (`OneOffCommitmentsPanel` + `CreditCommitmentsEmbed` recurring subscriptions), `simulator` (Payoff Strategy, Cutoff Check, & Wishlist).
  - **`/allocations` (*Plan & Events*):** `plan` (default: Monthly Plan, `SinkingFundsPanel` CRUD + `+ Contribute`, & Quota Simulator), `events` (`TripEventsPlannerPanel` with Go 3-tier cap advisor, shared friend advances, & Close & Sweep), `scenarios` (Monte Carlo What-If Lab & Wishlist).
  - **`/savings` (*Savings & Net Worth*):** `pockets` (default: Savings Pockets & Goals), `runway` (Net Worth & Survival Runway).
  - **`/reports` (*Reports & Insights*):** `summary` (default: Executive Statement & Equity Curve), `insights` (Trends, Comparative Variance, Multi-Period Analytics, & Audit), `export` (Excel & Email Export).
  - **`/preferences` (*Preferences*):** `formula`, `instruments`, `templates`, `display`, `notifications`, `backup`.
  - **Legacy Routes Retained via `redirect(...)`:** `/payday-wizard` -> `/payroll?sub=closing`, `/import` -> `/calendar?sub=import`, `/ledger` -> `/calendar?sub=ledger`, `/subscriptions` -> `/credit?sub=commitments`, `/scenarios` -> `/allocations?sub=scenarios`, `/wishlist` -> `/credit?sub=simulator`, `/analytics` & `/audit` -> `/reports?sub=insights`.
- **Button, Logo & Loading Standardization:** Primary buttons use `.erp-btn-primary` (muted dark emerald-slate `#12332a` + `#10b78d/45` border), secondary actions use `.erp-btn-secondary` (`#1d222e`), never glaring white `#f3f4f6` CTA fills (`bg-text-primary text-canvas`). Every workspace shares `<PageHeader />`, `<BrandMark />` appears in both Sidebar lockup and unified headers, and every App Router directory provides `loading.tsx` skeletons.
- **Zero Priority Jargon (`P1` / `P2` / `P3`):** Numeric priority tags (`P1`, `P2`, `Priority 1`, `Priority 2`) are purged from consumer UI copy and replaced by user-configured tier names managed in Preferences (`priorityTiers`: e.g., `Core Savings Reserve`, `Flexible Surplus`).
- **Zero `_rsc` Sub-Module Switching (`<15ms`):** Managed by `useSubModule` (`apps/web/hooks/useSubModule.ts`), `syncSubInUrl` (`apps/web/lib/tabs.ts`), and `window.dispatchEvent(new CustomEvent("erp:sub-change", ...))`. Both `?sub=` and legacy `?tab=` aliases resolve without Next.js server round-trips.
- **Standalone Fixed Modules:** `/wishlist`, `/audit`, and `/analytics` are enhanced in place (including `AnalyticsGoTelemetryStrip`) without collapsible sub-trees.

---

## 2. Ultrawide Layout Rules (`>= 1536px` / `1920px`)

- App workspaces use `w-full max-w-full` inside `AppShell` and main route containers rather than `max-w-6xl` or `max-w-7xl`, preventing large unused gutters along the right edge on wide desktop monitors.
- `apps/web/app/dev/components/page.tsx` (internal component testbench) is the only exception outside production routes.

---

## 3. Badge Formatting, Humanized Copy & Trilingual Coverage

- **Zero Dev-Leakage Standard:** Technical engine references (`Go Engine`, `TS Engine`, `Formula: Math.round(...)`, raw `BURNING_FAST` enum names) are stripped from user-facing UI surfaces. Sub-modules use natural human-readable labels (`Savings Runway`, `Cash & Savings vs. Remaining Debt`, `Daily Spending Pace & Next-Cycle Charges`, `Next-Cycle New Charges`, `Upcoming Monthly Relief (Finishing Installments)`, `Payday & THR Split-Bill Planner`) paired with `(?)` explainer tooltips (`title`).
- **Clean Input Surfaces:** Native `<input type="number">` spin steppers are suppressed globally in `apps/web/app/globals.css`.
- **Single-Line Localized Pill Badges:** Classification and status columns (`DataTableRow.tsx`, `SavingsTransactionsTable.tsx`, `RecentTransactionsTable.tsx`, `LedgerClientView.tsx`) use `min-w-[160px] max-w-[260px]` and `inline-flex items-center whitespace-nowrap` with Title/Sentence Case localized labels (`t("badge.*")`) rather than wrapping two-line ALL-CAPS strings.
- **Stable Zero-Flicker Sub-Tab Switching (`useSubModule.ts`):** `useSubModule` stabilizes `validKeys`/`defaultKey`/`aliasMap` via `useRef`, reads `window.location.search`, and syncs on `popstate` + `erp:sub-change` so sub-tabs across `/credit`, `/payroll`, `/allocations`, `/savings`, `/reports`, and `/preferences` never snap back to default.
- **Budget Shortfall Banner (`DeficitAlert.tsx`):** Uses humanized, actionable shortfall copy across `EN` / `ID` / `ZH` (`t("deficit.*")`) via `useLanguage()`.
- **Settled Routine Quota Integrity (`RoutineBillsQuotaCard.tsx`):** Routine categories already settled in full lock their revision button (`isSettledInFull`) with a direct tooltip pointing users to adjust or undo settlement in Ledger first, and the "+ Enable / Adjust Routine Quota" toggle stays hidden on locked closed cycles.
- **Cash Calendar UX (`CashRadarCalendarClient.tsx` + `MiniTrendChart.tsx`):** Period switching stays consolidated in `<AppHeader />` with no duplicate in-page stepper; activity category pills sit on a dedicated toolbar row above the Calendar/Day Inspector grid, and the Cash Trajectory SVG supports exact interactive day hover tooltips while Go & API labels use `Core Savings Transfer` instead of `Priority 1`.
- **Payroll Workbench Ergonomics (`PayrollClientView.tsx` + `PayrollAdjustmentForm.tsx`):** Uses a clean two-card right workbench (`Cycle Parameters & Payout Schedule` plus `Direct Payroll Deductions & Custom Items`) driven by segmented button pills (zero native `<select>` elements), exact `PRORATED_EXACT` Dec THR math (`Rp 3.833.425` baseline), and a balanced two-column bottom grid for Contractual Base Rate and Quick Inflow logging.
- **100% Trilingual Parity (`LanguageContext.tsx`):** Every intelligence label (`intel.*`), sub-module (`sub.*`), badge (`badge.*`), privacy guard notice (`privacy.*`), calendar hover copy (`calendar.*`), deficit banner (`deficit.*`), plus DOM-level `PHRASE_MAP` coverage across all 13 routes renders cleanly in English (`en`), Bahasa Indonesia (`id`), and Simplified Chinese (`zh`).

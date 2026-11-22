# Sub-Module Architecture, Ultrawide Layout & Copy Standards

## 1. Unified Overview vs Expandable Sidebar Sub-Modules

- **Overview (`/`) stays single-surface:** `OverviewClientView.tsx` renders one continuous vertical workspace (`OverviewExecutiveRibbon` -> 3-column Core Bento Grid -> `OverviewIntelligenceStrip` -> `RecentTransactionsTable`) with **zero sidebar sub-modules**.
- **`RecordExpenseCard.tsx` Work-Hours Badge:** Displays live equivalent work-hours cost derived from the active period's `lifeenergy.trueNetHourlyWageRp` as amounts are entered.
- **Six Expandable Sidebar Parent Routes (`Sidebar.tsx` `SUBMODULES_BY_ROUTE`):**
  - `/payroll`: `payslip` (default), `timeline`, `lifeenergy`
  - `/allocations`: `waterfall` (default), `envelopes`, `revisions`
  - `/credit`: `matrix` (default), `contracts`, `simulator`, `reconciler`
  - `/savings`: `vault` (default), `networth`, `forecaster`
  - `/reports`: `executive` (default), `variance`, `export`
  - `/preferences`: `formula` (default), `instruments`, `accounts`, `templates`, `navigation`, `notifications`
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
- **100% Trilingual Parity (`LanguageContext.tsx`):** Every intelligence label (`intel.*`), sub-module (`sub.*`), badge (`badge.*`), deficit banner (`deficit.*`), plus DOM-level `PHRASE_MAP` coverage across all 13 routes renders cleanly in English (`en`), Bahasa Indonesia (`id`), and Simplified Chinese (`zh`).

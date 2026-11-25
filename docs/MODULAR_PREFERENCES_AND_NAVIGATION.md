# Modular Preferences Studio & Dynamic Navigation

## 1. Persistence Schema (`ModularStudioConfig`)

User-configurable formula parameters, instrument cutoffs, asset reservoirs, routine envelopes, and navigation overrides live inside `GlobalConfig.formulaParamsJson.studioConfig` (`apps/api/src/config/studio.defaults.ts`).

- Default assembly: `buildDefaultStudioConfig` / `resolveStudioConfig` backfill missing nested fields safely when reading older `GlobalConfig` rows.
- Mutation endpoint: `PATCH /api/config/studio` (`ConfigController` -> `ConfigService.updateStudioConfig`), validated through `UpsertGlobalConfigDto`.
- Frontend synchronization: `PerspectiveContext` (`apps/web/context/PerspectiveContext.tsx`) holds live `studioConfig` and exposes `updateStudioConfig`, triggering immediate sidebar and widget updates plus `erp:data-mutated` invalidation without waiting for full SSR reloads.

- **Consolidated 8-Hub Navigation (`Sidebar.tsx` + `lib/tabs.ts`):** `/` (*Overview*), `/calendar` (*Cashflow & Ledger*: `calendar`, `ledger`, `import`), `/payroll` (*Income & Payday*: `payslip`, `closing`, `lifeenergy`), `/credit` (*Bills & Credit*: `matrix`, `commitments`, `simulator`), `/allocations` (*Plan & Events*: `plan`, `events`, `scenarios`), `/savings` (*Savings & Net Worth*: `pockets`, `runway`), `/reports` (*Reports & Insights*: `summary`, `insights`, `export`), and `/preferences` (+ `/admin` for `SUPERADMIN`). Legacy standalone paths (`/payday-wizard`, `/import`, `/ledger`, `/subscriptions`, `/scenarios`, `/wishlist`, `/analytics`, `/audit`) remain alive via server `redirect(...)` preserving `?month=&year=&scope=`.

---

## 2. Six Full-Width Non-Overflowing Sub-Modules (`/preferences`)

Implemented across `apps/web/components/preferences/PreferencesStudio.tsx`, `PreferencesNav.tsx`, `StudioTables.tsx`, `AccountDisplayPanel.tsx`, and `BackupDataTab.tsx`:

1. **`formula` (*Paycycle & Priority Rules*):**
   - Two-Stage Payroll (`payslipAnchorDay`, `payslipShiftRule`, `reviewLagWorkingDays`, `paydayAnchorDay`, `periodOverrides`, `holidayDatesIso`), **Configurable Priority Tiers (`priorityTiers`)** defining human labels & allocation rank end-to-end without `P1`/`P2`/`P3` badges, plus 7 Formula DSL expressions (`Verify Live`).
2. **`instruments` (*Payment Methods & Cutoffs*):**
   - Full-width responsive table editing custom cards, PayLater lines, and loans (`cutoffDay`, `dueDay`, `dueRule`, `monthlyInterestPct`, `adminFeePct`, `creditLimitRp`, `utilizationWarnPct`) with zero right-edge column clipping and zero hardcoded brands.
3. **`templates` (*Routine Bills, Accounts & Savings Pockets*):**
   - Unified Routine Envelope templates (propagating identically across Overview, Allocations, and Envelopes), `enableExternalAssetPortfolio` / `assetAccountsTable`, and default `savingsPockets` templates.
4. **`display` (*Account, Privacy & Display*):**
   - Profile details + **Change Account Password (`POST /api/auth/change-password`)**, Privacy Mask defaults (`maskBalancesByDefault`, `requirePasswordToReveal`), default Language (`EN`/`ID`/`ZH`), Number Format (`id-ID` / `en-US`), UI Density (`Command Cockpit` / `Simple Clarity`), and Sidebar Visibility/Ordering (`SidebarMenuBuilderCard`).
5. **`notifications` (*Notifications & Promo Watch*):**
   - Separated cleanly into Promotional Auto-Renew Watchlist and SMTP Email / WhatsApp Dispatch Controls (`SmtpControlPanel`).
6. **`backup` (*Backup, Restore & Data*):**
   - Dedicated atomic full-ledger JSON archive export, off-site restore (`DatabaseBackupRestoreCard`), and workspace reset controls (moved out of SMTP email sub-panel).

# AI Context Map (`mondaymondayv2`)

Exact module and symbol locations to minimize redundant search reads. See also:
- `docs/PRD.md`
- `docs/ERD.md`
- `docs/ARCHITECTURE_AND_UX_FLOW.md`
- `docs/MARQUEE_AI_COPILOT.md`
- `docs/COPYWRITING_AND_DESIGN_SYSTEM.md`
- `docs/TDD_AND_ERROR_CATALOG.md`
- `docs/ERD_AND_MOBILE_API_CONTRACT.md`
- `docs/MOBILE_PRD.md`
- `docs/MOBILE_ARCHITECTURE.md`
- `docs/MOBILE_TDD_AND_UX_SPEC.md`
- `docs/GO_ENGINE_ARCHITECTURE.md`
- `docs/PAYCYCLE_HORIZON_AND_CUTOFF_LAW.md`
- `docs/MODULAR_PREFERENCES_AND_NAVIGATION.md`
- `docs/SUBMODULE_UX_AND_COPY_STANDARDS.md`
- `docs/FORMULA_DSL_AND_RESERVED_WORDS.md`

## Backend (`apps/api/src/` & `apps/go-engine/`)

### Go & TS Calculation Engine (`apps/go-engine/internal/` & `apps/api/src/calculator/`)
- `apps/go-engine/internal/{paycycle,networth,forecaster,anomaly,envelopes,debtopt,lifeenergy,reconciler,formula}/`: 9 integer (`int64`) calculation engines exposed via `apps/go-engine/cmd/engine/main.go`.
- `erp-engines.ts` & `hybrid-engine.ts`: 100% deterministic TypeScript parity mirrors (`computePaycycleHorizonTs`, `evaluateConfiguredWaterfallTs`, `routeTransactionToPaycycleTs`, `computeNetWorthTs`, `runForecastTs`, `evaluateAnomaliesTs`, `evaluateEnvelopesTs`, `optimizeDebtPayoffTs`, `computeLifeEnergyTs`, `parseStatementBatchTs`, `evaluateFormulaDslTs`, `evaluateFormulaSuiteTs`, `buildCashRadarTs`) paired with Go binary execution (`radar.go` -> `cash-radar` CLI + `GoBridgeService` -> `GET /api/finance/cash-radar`).
- `payroll.ts`: includes `calculateWorkingDaysForConsumptionPeriod(month, year)` anchoring Period `M` attendance cutoff (`16th M-2..15th M-1`) on `(M-1, Y')` rather than `M`.
- `modular-engine.ts`: `evaluateModularEngine`, `buildDefaultPayrollRules`, `buildDefaultAllocationBuckets`, `buildDefaultSurplusSplitRules`, `buildDefaultFinancialPolicy`. Handles `isManualOverride` (honors locked Tier 0 living cash, `lockedP1`, `lockedP2` without non-cash debt cannibalization), `oneOffBills` slot labels.
- `waterfall.ts`: `calculateTotalDeductions`, `calculateWaterfall`, `calculateFixedEssentialsRealization`.
- `credit-limit.ts`: `calculateCreditUsageLimit` (waterfall-bounded 20% optimal / 35% manageable debt ceiling).
- `pacing.ts`: 3-state payday-to-payday daily pacing (`PRE_PAYDAY` / `ACTIVE` with `paceDeltaRp` / `COMPLETED`) and `resolveDefaultActivePeriod` (`EARLIEST_OPEN_ACTIVE` vs `CALENDAR_WINDOW`).

### Marquee 3-Tier Financial AI Co-Pilot & AES-256-GCM Crypto (`apps/api/src/marquee/` & `apps/api/src/common/`)
- `common/crypto.util.ts`: `encryptSecret`, `decryptSecret` (`v1:<ivHex>:<authTagHex>:<cipherHex>` AES-256-GCM), `generateMarqueeToken` (`mrq_*`), `hashSecretToken` (SHA-256), `verifySecretToken` (`crypto.timingSafeEqual`).
- `marquee/marquee-context.service.ts`: `MarqueeContextHydrator.hydrateForUser` (userId-scoped paycycle state, multi-cycle snapshots, canonical due days `[11, 17, 23, 24, 25]` with H-1 business-day shift on the 11th + dynamic `daysInMonth-15` SPayLater / `25th` Permata CC cutoffs, payoff milestones `JAN '27` / `FEB '27` / `SEP '27`, active route/sub-tab context, and 6 Human Writing Laws system prompt).
- `marquee/marquee-nlu.ts`: `parseMarqueeIntent` (<5ms Tier 1 trilingual EN/ID/ZH NLU parser).
- `marquee/marquee-tools.service.ts`: `MarqueeToolsService.executeTool` (15 curated business tools: `get_paycycle_pulse`, `simulate_purchase_cutoff`, `optimize_payday_thr_split`, `analyze_debt_burndown`, `evaluate_custom_formula` via AST `evaluateFormulaDslTs` with zero dynamic eval, `prepare_quick_transaction`, `prepare_wallet_checkin`, `explain_period_variance`, `manage_user_memory`, `search_financial_history`, `refuse_out_of_scope` + mutation/alias handlers).
- `marquee/marquee-llm.service.ts`: `MarqueeLlmService` (DeepSeek V4.1 Flash `deepseek-flash` / `deepseek-chat` / `deepseek-reasoner` with bounded 4-hop ReAct tool loop, OpenCode `deepseek-v4.1-flash-free`, `@google/genai` `gemini-3.8-flash`, and Groq `llama-3.3-70b-versatile` with Tier 1 fallback).
- `marquee/marquee.controller.ts` (`/api/marquee`): `POST /chat`, `POST /chat/stream` (SSE progress + answer streaming), `GET /memory`, `DELETE /memory/:id`, `GET /config`, `PUT /config`, `POST /webhook-token/rotate`, `POST /webhook` (`X-Marquee-Token`), and `POST /mcp` (authenticated JSON-RPC 2.0 MCP server paired with `scripts/sundayfunday-mcp.ts`).

### Credit & Debt Matrix (`apps/api/src/credit/`)
- `credit.controller.ts` (`/api/credit`):
  - `GET /matrix` -> `CreditSelectors.getLiabilityMatrix`
  - `GET /installment-plans` -> `CreditSelectors.listInstallmentPlans`
  - `GET /line-items`, `POST /line-items`, `POST /line-items/:id/shift`, `DELETE /line-items/:id`
  - `POST /bridge-loan`, `POST /bridge-loan/accelerate`
  - `PUT /bulk-bills/:id`, `POST /bulk-bills`
- `credit.service.ts`: `createLineItem`, `shiftLineItem`, `deleteLineItem`, `createBridgeLoan`, `accelerateBridgeLoan`, `recomputeBulkBillFromLineItems`, `syncLiabilitiesToSnapshot`.
- `credit.selectors.ts`: `getLiabilityMatrix` (returns dual-timeline `columns`, itemized cells, `activeInstallmentPlans`, `contractRows` with `isIncludedInMatrixRows: true`, `lineItemsPerMonth`), `listLineItems`, `listInstallmentPlans`.
- `credit.utils.ts`: `calculateCardDueAmountForMonth`, `calculateCardInstallmentProgress`.
- `kill-switch-message.ts`: `DEFAULT_KILL_SWITCH_MESSAGE_TEMPLATE`, `formatKillSwitchEmailSubject`, `buildKillSwitchEmailHtml` (formal English cancellation correspondence).

### Email Delivery, Profile Auth & Security Hardening (`apps/api/src/email/`, `apps/api/src/auth/`, `apps/api/src/main.ts`)
- `main.ts`: Strict `isAllowedCorsOrigin` permitting Sunday Funday domains (`/^https:\/\/sundayfunday(?:-[a-z0-9-]+)?\.vercel\.app$/`) and explicit localhost origins (`CORS` wildcard `*.vercel.app` removed), security headers (`HSTS`, `X-Content-Type-Options`, `Referrer-Policy`).
- `auth/rate-limiter.service.ts`: `RateLimiterService` providing synchronous checks plus Postgres-backed `AuthRateLimit` persistence (`checkAsync`, `recordFailureAsync`, `recordSuccessAsync`) for serverless multi-isolate brute-force protection.
- `auth/sso.service.ts`: `SsoService` & `listConfiguredSsoProviders` verifying cryptographic `RS256`/`ES256` JWKS tokens for `GOOGLE`, `APPLE`, and `OIDC`.
- `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/auth.middleware.ts`, `auth/auth.utils.ts` (`/api/auth`): `POST /login`, `POST /refresh` (opaque `sf_rt_*` token rotation + family reuse theft revocation), `GET|DELETE /sessions`, `POST /logout`, `POST /logout-all`, `POST /pin/setup`, `POST /pin/verify`, `POST /biometric/enroll`, `DELETE /biometric/:deviceId`, `POST /biometric/challenge`, `POST /biometric/verify` (`ECDSA_P256`/`ED25519` single-use challenge-response), `GET /sso/providers`, `POST /sso/exchange`, `POST /sso/link`, `DELETE /sso/:id`, `POST /demo-login`, `POST /demo-reset`, `PATCH /profile`, `POST /change-password` (`scryptv2`, revoking open sessions) paired with immediate `AuthMiddleware` JWT `sid` revocation enforcement.
- `common/idempotency/`: `IdempotencyService`, `IdempotencyInterceptor`, `IdempotencyModule` enforcing 24h `Idempotency-Key` deduplication and `409 Conflict` payload-hash checks on mobile financial mutations.
- `email.controller.ts` (`/api/email`): `GET /status` (includes `profileEmail` & `platformFrom`), `POST /verify`, `POST /preview` (strictly read-only template renderer), `POST /test-dispatch`, `POST /monthly-statement`, `POST /cutoff-digest`, `POST /ledger-backup` (dispatch endpoints accept optional `dryRun: boolean`).
- `email.service.ts`: `getStatus` & `verifyConnection` (`mode: 'LIVE_SMTP' | 'AUTH_ERROR' | 'DRY_RUN_PREVIEW'` backed by real `verifySmtpConnection`), decoupled `From`/`Reply-To` (`PLATFORM_EMAIL_FROM` = `"Sunday Funday ERP" <sundayfundayerp@gmail.com>`) vs `To` (`User.email`) vs Gmail SMTP Auth Login, Stripe/Linear/Mercury light-canvas HTML templates (`EN`/`ID`/`ZH`), and synthetic pentest lockout alert suppression (`isSyntheticProbeIdentifier`).
- `smtp-transport.util.ts`: Shared SMTP utility providing `PLATFORM_EMAIL_FROM`, `PLATFORM_EMAIL_REPLY_TO`, `isSyntheticProbeIdentifier`, `normalizeSmtpAppPassword`, `sanitizeSmtpMessage`, `classifySmtpError` (`535`/`534`/`ETIMEDOUT`/TLS/`550`), `verifySmtpConnection`, and `sendSmtpMailWithFallback` (automatic `465` SSL -> `587` STARTTLS retry for network/TLS failures).
- `dto/preview-email.dto.ts` & `dto/email-dispatch.dto.ts`: Strict `class-validator` DTOs compatible with `ValidationPipe({ whitelist: true })`.

### Snapshots & Finance (`apps/api/src/snapshots/` & `apps/api/src/finance/`)
- `snapshots.controller.ts` (`/api/snapshots`):
  - `GET /`, `GET /horizon` (read-only 12-month snapshot batch via `SnapshotsSelectors.getSnapshotHorizon`)
  - `POST /:id/budget-revision` (accepts `isOneOff` & `oneOffLabel`)
  - `POST /:id/borrow-p1` -> `SnapshotsService.borrowFromP1Vault`
  - `POST /:id/recalculate`, `POST /:id/close`, `POST /:id/reopen`
- `finance.controller.ts` (`/api/finance`): `GET /payroll-horizon` (`FinanceSelectors.getPayrollHorizon`, 12-month read-only payroll projection batch), `GET /cash-radar` (`FinanceSelectors.getCashRadarProjection`, Go/TS Cash Radar daily events & Lowest Cash Point trough), `GET /pacing`, `GET /transactions`, `GET /intelligence` (`FinanceSelectors.getIntelligenceBundle`), `POST /formula/evaluate` (`FinanceSelectors.evaluateFormulaSuiteForUser`), `POST /reconciler/parse` (`FinanceSelectors.parseStatementForUser`), `POST /reconciler/commit` (`FinanceService.commitReconcilerRows`).
- `snapshots.service.ts`: Deterministic `budgetRevisions` replay (`createdAt asc, id asc`), `frozenRulesJson` attendance rate extraction, `borrowFromP1Vault`.
- `finance.service.ts`: `createTransaction` with cross-bucket `paymentMethod: 'PAYLATER' | 'CC' | 'CASH'` routing via `CreditService`, plus `evaluateAndPersistWalletGuard` (enforces `LOCKED` immutability on `persist: true`).

### Modular Studio Config (`apps/api/src/config/`)
- `studio.defaults.ts`, `config.selectors.ts`, `config.service.ts`, `config.controller.ts`: `ModularStudioConfig` stored under `GlobalConfig.formulaParamsJson.studioConfig`, updated via `PATCH /api/config/studio`.

### Prisma Schema (`apps/api/prisma/schema.prisma`)
- `LiabilityCategory`: `PAYLATER`, `PERSONAL_DEBT`, `CREDIT_CARD`, `P1_VAULT_REFUND`.
- `LiabilityLineItem`: Itemized debt sub-ledger linked 1:1 per month to `MonthlyBulkBill`.
- `MonthlySnapshot`: Includes `isManualOverride`, `lockedP1`, `lockedP2`, `bridgeInflowAmount`, `oneOffBillsJson`.

## Frontend (`apps/web/`)

### Typed API Client, Period Reactivity & Profile Context (`apps/web/`)
- `lib/api.ts`: Types & API helpers including `fetchSnapshotHorizon`, `fetchPayrollHorizon`, `prefetchHorizonData`, `swrFetch` wrappers, `updateProfile`, `erp:data-mutated` invalidation hook, plus all credit/savings/budget mutation helpers.
- `context/PeriodContext.tsx` & `hooks/usePeriodSlice.ts`: Client-side period coordinator syncing `month`/`year` via `window.history.replaceState` (`MonthYearSwitcher.tsx` & `Sidebar.tsx`), 12-month horizon prefetching (`07/2026–06/2027`), shallow SSR-prop synchronization, and stale-response cancellation (`reqSeqRef`).
- `context/AuthContext.tsx` & `components/shell/ProfileSettingsModal.tsx`: Authenticated profile state (`updateUserProfile`), header `AccountHeaderBadge.tsx` dropdown trigger, and live email/name editor decoupled from Gmail SMTP Auth Login.
- Period-reactive Client Views wrapping slim SSR initializers: `components/overview/OverviewClientView.tsx` (`app/page.tsx`), `components/payroll/PayrollClientView.tsx` (`app/payroll/page.tsx`), `components/allocations/AllocationsClientView.tsx` (`app/allocations/page.tsx`), `components/savings/SavingsClientView.tsx` (`app/savings/page.tsx`), `components/credit/CreditPageClient.tsx` (`app/credit/page.tsx`), `components/ledger/LedgerPageClient.tsx` (`app/ledger/page.tsx`), and `components/wishlist/WishlistPageClient.tsx` (`app/wishlist/page.tsx`).

### Credit Workspace (`apps/web/app/credit/page.tsx` & `apps/web/components/credit/`)
- `matrix/LiabilityMatrixTable.tsx`: Dual-timeline headers, clickable cells -> `MatrixCellDrawer`, `SafeSpendSimulatorPanel`, `BridgeLoanModal`, populated `Active Installment Contracts`, early payoff action, cutoff countdown.
- `matrix/MatrixCellDrawer.tsx`: Slide-over drawer for itemizing, shifting (`Earlier`/`Later`/`Shift Plan`), splitting across cutoffs, adding installments, or bulk overriding.
- `matrix/SafeSpendSimulatorPanel.tsx`: Non-mutating purchase & Windfall/THR simulator with 1-click commit.
- `matrix/BridgeLoanModal.tsx`: Bridge loan liquidity splitter (`Living Cash` + `Routine Bills`) & installment generator.
- `contracts/ActiveContractsHub.tsx`, `contracts/DebtFreedomTimeline.tsx`, `contracts/CreditContractsTable.tsx`, & `CreditWishlistEmbed.tsx`: 5-tier contracts hub (SPinjam-first priority, interactive Cashflow Freed Up Horizon, inline cycle mark-paid, and live `Rp 1.000.000` Snowball vs Avalanche optimizer), plus embedded Wishlist planner inside `/credit?sub=simulator`.
- `components/payday/PaydayWizardClient.tsx` (`app/payday-wizard/page.tsx`) & `components/calendar/CashRadarCalendarClient.tsx` (`app/calendar/page.tsx`): 4-step monthly payday closing wizard and Go/TS Cash Radar `Mon–Sun` calendar grid plotting paydays, dynamic SPayLater (`15th`/`16th`) & Permata CC (`25th`) cutoffs, `H-1` business-day due shifts (`2027-04-09`), `3/3` final slices, synced SVG balance curve, Day Inspector, and Lowest Cash Point trough.
- `components/marquee/{MarqueeCoPilotDrawer.tsx,MarqueeWorkspaceClient.tsx,MarqueeResponseCards.tsx}` (`app/marquee/page.tsx`) & `components/preferences/MarqueeAiSettingsPanel.tsx` (`/preferences?sub=ai`): Native `<dialog>` `Alt+M` drawer, Markdown table/list renderer without dev leakage, full-page AI co-pilot workspace, and AES-256-GCM BYOK (`deepseek-flash` default) / `X-Marquee-Token` manager.

### Overview & Shell (`apps/web/components/overview/` & `apps/web/components/shell/`)
- `RecordExpenseCard.tsx`: Segmented payment instrument selector (`Living Cash` | `PayLater` | `Credit Card`) + tenor + post-cutoff toggle.
- `BudgetRevisionModal.tsx`, `BudgetRevisionHistoryPopover.tsx`, & `RoutineBillsQuotaCard.tsx`: Dynamic `oneOffBillsJson` slot labels, icon-only revision history trigger, `Pay Full · ...` / `Roll to PayLater` / collapsible `Log Partial` actions.
- `AdaptiveDailyPacingCard.tsx`: Wallet Reconciliation decomposing `Living Cash + Unpaid Routine Bills = Expected in Bank`, 2-mode balance sync toggle, and live post-sync preview.
- `CoreSavingsCard.tsx`: `Forward-Borrow P1` modal calling `borrowFromP1Vault`.
- `AccountHeaderBadge.tsx`, `AppHeader.tsx`, & `TopProgressBar.tsx`: Z-indexed header profile dropdown with 1-click Privacy Stealth toggle and bottom-right route loading pill.
- `GlobalSearchModal.tsx`: `Ctrl+K` quick jumps to Matrix, Simulator, Bridge Loan Wizard, Contracts, and Overview.

### Brand Identity, Multi-Tab Studios & Subscriptions (`apps/web/`)
- `lib/tabs.ts`, `hooks/useSubModule.ts`, & `app/globals.css`: Server-safe `PREFERENCES_TAB_KEYS`, `useSubModule` / `syncSubInUrl` (`?sub=...` zero-`_rsc` client sub-module switching via `erp:sub-change`), `syncTabInUrl` (`history.replaceState`), WAI-ARIA `handleTabListKeyDown`, `.tab-panel` (`content-visibility: hidden` + `display: none` fallback), unified dark-slate highlight tokens (`.erp-surface-selected`, `.erp-callout-caution`, `.erp-callout-urgency`, `.erp-callout-positive`), and native `dialog.erp-dialog` styling.
- `components/finance/OverviewGoWidgets.tsx`, `ModuleGoPanels.tsx`, & `components/analytics/AnalyticsGoTelemetryStrip.tsx`: `OverviewExecutiveRibbon`, `OverviewIntelligenceStrip`, `TrueHourlyLifeEnergyPanel`, `EnvelopesAndSinkingPanel`, `DebtPayoffOptimizerPanel`, `BulkStatementReconcilerPanel`, `NetWorthReservoirsPanel`, `WealthForecaster12MPanel`, `AnalyticsGoTelemetryStrip`.
- `components/preferences/StudioTables.tsx`: `PaycycleFormulaStudioCard`, `InstrumentsTableCard`, `AssetAccountsTableCard`, `RoutineTemplatesTableCard`, `SidebarMenuBuilderCard`.
- `app/subscriptions/page.tsx` & `components/subscriptions/SubscriptionsStudio.tsx`: Dedicated `/subscriptions` workspace preloading recurring CC charges, one-off AI/digital charges, Kill-Switch states, routine category envelopes, cutoff countdowns, and native `<dialog>` quick-add modal (replacing `User Guide` in `Sidebar.tsx`, while keeping `/guide` in `AppHeader.tsx`).
- Instant `<10ms` client multi-tab/sub-module studios (parallel SSR preload, zero `_rsc` refetch): `components/preferences/PreferencesStudio.tsx`, `SmtpControlPanel.tsx`, `SubscriptionKillSwitchTab.tsx`, `PreferencesNav.tsx`, `components/credit/CreditStudio.tsx`, `components/wishlist/WishlistStudio.tsx`, `components/audit/AuditStudio.tsx`, and `components/reports/ReportsClientView.tsx`.
- `components/primitives/BrandMark.tsx`, `app/icon.svg`, `app/apple-icon.tsx`, `app/manifest.ts`: Geometric SVG brand mark used on login, mobile header, transition card, search modal, reports, and favicons (excluded from desktop `Sidebar.tsx`).
- `components/payroll/ThrBonusEstimatorCard.tsx` (`app/payroll/page.tsx`): Interactive THR, bonus & attendance sensitivity estimator.
- `app/savings/page.tsx`, `components/ledger/LedgerSummaryStrip.tsx`, `app/allocations/page.tsx`, `components/wishlist/WishlistPlannerView.tsx`, `components/audit/AuditScorecardView.tsx`: Reserve & P1 refund strip, daily burn checkpoints, 3-cycle cutoff planner, P2 vs PayLater affordability comparator, and deleveraging horizon view.

### Security, Tooling, Localization & Export Modules
- `scripts/erp-cli.ts`: Unified CLI (`report`, `sync`, `doctor`, `audit:u1`, `wishlist:clean-test`, `item:add`, `item:shift`) for Neon Cloud <-> Local PG (`127.0.0.1:5433`) operations.
- `scripts/restore-live-truth.ts`: Deterministic CLI verification/repair utility restoring authorized `10/2026` & `11/2026` baseline state and `frozenRulesJson` across Neon Cloud & Local DB.
- `scripts/erp-benchmark.ts`: Read-only API & Web route performance benchmark (45 routes across NestJS API and authenticated Demo Sandbox Next.js SSR; `npm run erp:benchmark -- [--live|--local]`).
- `scripts/erp-pentest.ts`: 8-point automated security & CORS/JWT/IDOR/rate-limit pentest suite (`npm run erp:pentest`), supporting local in-process testing or live remote targets via `--url=` / `--live`.
- `scripts/erp-email-e2e.ts`: Automated email & SMTP E2E verification suite (`npm run erp:email:e2e`), validating credential whitespace stripping, live verification accuracy, 535/422 zero-500 diagnostics, dry-run fallback, kill-switch reminder failures, password clear/reset, preview templates, and `.xlsx`/JSON attachments on Demo Sandbox (`userId = 2`).
- `scripts/verify-zero-defect-erp.ts`: End-to-end invariant check asserting Go tests, API Jest tests, User #1 Golden Ledger zero drift, disabled fabricated asset portfolio, formula-driven `11/2026` Credit Ceiling (`3.434.030`), `P1_VAULT_REFUND` exclusion on unlock milestones, itemized December SPinjam timeline dates, lock-safe reconciler advancement (`10/2026` -> `11/2026`), and `02/2027` milestone progression.
- `apps/web/context/LanguageContext.tsx` & `apps/web/components/shell/LanguageSwitcher.tsx`: Persistent trilingual (`EN` / `ID` / `ZH`) UI dictionary provider (`useLanguage()`) and switcher component.
- `apps/web/lib/exportReportsExcel.ts`: `ExcelJS` 5-sheet color-coded financial workbook generator (`buildExecutiveReportWorkbook` & `exportExecutiveReportToExcel`) with IDR formatting and live `=SUM(...)` / variance formulas.

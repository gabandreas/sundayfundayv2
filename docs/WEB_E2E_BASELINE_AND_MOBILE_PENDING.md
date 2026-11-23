# Web E2E Baseline & Mobile Pending Handoff (`WEB_E2E_BASELINE_AND_MOBILE_PENDING.md`)

> **Checkpoint Timestamp:** `2026-11-23 21:14 +07:00`
> **Active Decision:** Development on **Flutter Mobile (`apps/mobile`) is PAUSED (pending)** right after Phase 0–5 build completion (`de999e8`), returning full focus to **end-to-end Website (`apps/web` + `apps/api` + `apps/go-engine`) bug fixing and stabilization**.

---

## 1. Exact Anchor: When Was the Website Last Enhanced?

This section is the permanent chronological anchor so future sessions never lose track of the exact state of the Website vs Mobile work:

### Exact Cutoff Between Website Work and Mobile Work
- **Last commit touching Website UI (`apps/web`):** **`af79048`** — `2026-11-23 14:19:22 +07:00` (`Harden multi-tenant ERD, auth security, AST formula eval, Marquee layout, and mobile API docs`).
  - Website files touched in `af79048`: `apps/web/components/marquee/MarqueeWorkspaceClient.tsx`, `apps/web/components/preferences/MarqueeAiSettingsPanel.tsx`.
- **Last pure Web CSS/UI polish commit:** **`cec2a57`** — `2026-11-23 10:48:03 +0700` (`Enable native dark color-scheme across checkboxes and form controls` in `apps/web/app/globals.css`).
- **Mobile work started AFTER website paused at `14:19:22 +07:00`:**
  - `00df4dd` (`2026-11-23 19:28:35 +07:00`) — Phase 0 Flutter mobile scaffold & docs (`MOBILE_PRD.md`, `MOBILE_ARCHITECTURE.md`, `MOBILE_TDD_AND_UX_SPEC.md`).
  - `dfce84c` (`2026-11-23 19:58:55 +0700`) — Phase 1 Mobile Backend Auth/Security (`RefreshToken`, `MobileDevice`, `BiometricChallenge`, `UserIdentity`, `IdempotencyRecord`, PIN/SSO/Boot API).
  - `de999e8` (`2026-11-23 20:54:26 +07:00`) — Phase 2–5 Flutter mobile app (`apps/mobile`, APK built & Android emulator QA verified).

### Recent Website / API / Go Engine Enhancement Timeline (`2026-11-10` -> `2026-11-23 14:19 +07:00`)

| Date & Time (`+07:00`) | Commit | Scope | What Changed on Website / Backend / Go Engine |
| :--- | :--- | :--- | :--- |
| `2026-11-10 08:49:36` | `8751a2a` (`origin/main`) | Routine / Seed | Confined `Nov 25 Bill` to `10/2026`, cleared default template, restored `11/2026` & `12/2026` quotas. *(Current remote `origin/main` pointer — **46 commits behind local `main`**).* |
| `2026-11-11 22:44–23:05` | `18cb61c`, `f7b6d9c` | Credit / Matrix | Added 11.11 PayLater 3-month installments, SPinjam schedule, aligned to payday-to-bill convention. |
| `2026-11-22 10:33–11:04` | `a9a1b0b`..`37b83d4` | Core Auth & UX V2.5 | Enforced `USER` vs `SUPERADMIN` isolation, implemented 3-state daily pacing + smart default period, rebuilt Credit Contracts Hub, added `/payday-wizard` and `/calendar`. |
| `2026-11-22 11:19–12:26` | `63eecea`..`6f1d8f2` | Marquee V1–V2 & Design Purge | Built Marquee 3-tier deterministic AI Co-Pilot (`Alt+M` native `<dialog>` drawer), DeepSeek/OpenCode adapters, `BrandMark`, purged AI-slop circular icons & blur cards, humanized EN/ID/ZH copy. |
| `2026-11-22 13:31–16:13` | `3586600`..`86d759e` | Consumption Month & Go Cash Radar | Aligned entire system to `Payday(M-1) -> Day before Payday(M) = Period M`, dynamic SPayLater `daysInMonth-15` & Permata CC `25th` cutoffs, H-1 11th shift, authoritative Go/TS Cash Radar (`radar.go`) + `/calendar` curve & trough. |
| `2026-11-22 23:03:40` | `b995888` | **V2.6 Website Overhaul** | Major frontend & module overhaul (`117 files`): added `/import` (`StatementImportClient`), `/scenarios` (`ScenarioLabClient`), `/savings` pockets (`SavingsPocketsCard`), visual `/reports` SVG charts (`ReportsEquityChart`, `ReportsSpendingBreakdown`), 6-tab `/preferences` (`AccountDisplayPanel`, `PriorityTiersEditor`), `/subscriptions`, loading skeletons across routes, unified dark-slate CTAs, full `EN`/`ID`/`ZH` parity. |
| `2026-11-22 23:26:30` | `6c0d1b7` | Web Hotfix | Fixed `/scenarios` `Headers` spread `401` auth bug, header/reports line wrapping, Win1252 mojibake, remaining `P1`/enum copy leaks. |
| `2026-11-23 08:57:43` | `d550ca7` | Golden Ledger | Synced User #1 Golden Ledger for Nov 23 SPayLater entry (`Rp 52.000` -> `01/2027`). |
| `2026-11-23 10:23:38` | `f14f78c` | Modular Formulas & Marquee V3 | Dynamic `H-15` cutoff formulas across Go/TS/DSL (`formula-dsl.ts`), explicit billing cycle picker in `RecordExpenseCard`, `MatrixCellDrawer`, `SafeSpendSimulatorPanel`, `MarqueeRobotAvatar`, Marquee V3 upgrade. |
| `2026-11-23 10:39–10:48` | `d068b6b`, `cec2a57` | Preferences & Form Controls | Polished `Preferences` instrument cards (`StudioTables.tsx`), Marquee reasoning copy, native dark `color-scheme` across checkboxes & form inputs (`globals.css`). |
| `2026-11-23 13:26:28` | `0d1c05b` | Marquee V4 + MCP | ReAct 4-hop tool loop, guardrails, persistent user memory rules, history search tool, `POST /api/marquee/mcp` + `scripts/sundayfunday-mcp.ts`. |
| **`2026-11-23 14:19:22`** | **`af79048`** | **Last Pre-Mobile Web/API/Docs Commit** | Hardened multi-tenant `userId` scoping across selectors/services, Postgres-backed `AuthRateLimit`, AST-only formula evaluation, `MarqueeWorkspaceClient` & `MarqueeAiSettingsPanel` layout/hardening, and `ERD_AND_MOBILE_API_CONTRACT.md`. |

---

## 2. Repository, Git, Vercel & Database Ground Truth

- **Git Branch & Remote Drift:** Local `main` is at `de999e8`, **`46` commits ahead of `origin/main` (`8751a2a`)** on `https://github.com/gabandreas/sundayfundayv2.git`. Push to GitHub has NOT been run yet.
- **Untracked Files in Working Tree (do not delete blindly):**
  - `apps/api/scripts/apply-nov-dec-paylater-updates.ts`
  - `apps/api/scripts/apply-workstream0-nov-paylater.ts`
  - `apps/api/scripts/seed-subledger-and-locks.ts`
- **Vercel Project Links:**
  - Web: `sundayfunday-erp` (`prj_vlHQYMrGA3PtnFl4PrXPFsBHiTie`)
  - API: `sundayfunday-api` (`prj_I7mLc2QFiF68O4gAR64Y5zgvOUnU`, live origin `https://sundayfunday-api.vercel.app`)
- **Live Neon PostgreSQL Users (`User` table verified `2026-11-23 21:10 +07:00`):**
  - `id: 1` — `cheeseburger` / `cheeseburger` (`gabandreas22@gmail.com`) — `role: USER`, **Protected User #1 Golden Ledger** (never run destructive writes/tests here).
  - `id: 2` — `demo` / `guest` (`demo@sundayfunday.id`) — `role: DEMO_SANDBOX` (target for E2E/bug-bounty mutations).
  - `id: 3` — `superadmin` / `superadmin` (`superadmin@sundayfunday.erp`) — `role: SUPERADMIN` (sole role allowed into `/admin` & `/admin/sql`; default password `SuperAdmin#2026!`, Security PIN `271026`).
  - `id: 4` — `mei` / `meimeri` (`meimeri95@gmail.com`) — `role: BESPOKE_CLIENT`, created `2026-11-23 14:08:48Z` via `/admin` (verified matching default modal tempPassword `Password#2026`).
- **Local PostgreSQL (`127.0.0.1:5433`):** Observed offline during quick CLI probe (`Can't reach database server at 127.0.0.1:5433`); use `npm run erp:sync` after starting local DB/proxy if doing offline local DB verification.

---

## 3. Website End-to-End Refresh Map (`apps/web` + `apps/api` + `apps/go-engine`)

### Frontend Routes (`apps/web/app/`, `22` App Router Pages)

| Category | Routes (`apps/web/app/`) | Key Components & Notes |
| :--- | :--- | :--- |
| **Core Cockpit & Planning** | `/`, `/allocations`, `/payroll`, `/calendar`, `/ledger`, `/savings` | URL-synced `PeriodContext` (`?month=&year=`) with 12-month horizon prefetch (`07/2026–06/2027`), `<10ms` `?sub=` tab switching (`useSubModule`), `OverviewClientView`, `CashRadarCalendarClient`, `SavingsPocketsCard`, Privacy Stealth eye toggles, `TopProgressBar`. |
| **Credit & Obligations** | `/credit`, `/subscriptions`, `/wishlist`, `/payday-wizard` | `CreditStudio`, `LiabilityMatrixTable` + `MatrixCellDrawer`, `SafeSpendSimulatorPanel`, `BridgeLoanModal`, `ActiveContractsHub` + `DebtFreedomTimeline`, `SubscriptionsStudio`, `WishlistPlannerView` (`WishlistStudio`), 4-step `PaydayWizardClient`. |
| **Intelligence, Import & Reporting** | `/marquee`, `/reports`, `/analytics`, `/import`, `/scenarios`, `/audit` | `MarqueeWorkspaceClient` + global `Alt+M` `<dialog>` drawer (`MarqueeCoPilotDrawer`), `ReportsClientView` (`ReportsEquityChart`, `ReportsSpendingBreakdown`, Excel export via `ExcelJS`), `StatementImportClient`, `ScenarioLabClient`, `AuditStudio`, `AnalyticsGoTelemetryStrip`. |
| **Settings, Guide & System** | `/preferences`, `/guide`, `/login`, `/admin`, `/admin/sql`, `/dev/components` | 6-tab `PreferencesStudio` (`AccountDisplayPanel`, `PriorityTiersEditor`, `StudioTables`, `MarqueeAiSettingsPanel`, `SmtpControlPanel`, `SubscriptionKillSwitchTab`, `DatabaseBackupRestoreCard`), `UserGuideClientView`, `/login` (with IP PIN challenge + Demo button), `SUPERADMIN`-guarded `/admin` & `/admin/sql`. |

### Backend Domain Modules (`apps/api/src/`, `17` Folders)
- `admin`, `analytics`, `audit`, `auth`, `bills`, `calculator`, `common`, `config`, `credit`, `email`, `finance`, `marquee`, `prisma`, `reports`, `savings`, `snapshots`, `wishlist`.
- All controllers follow `controller -> service (writes) / selectors (read-only)` + `src/calculator/` single calculation source of truth.

### Go Engine Packages (`apps/go-engine/internal/`, `14` Folders)
- `anomaly`, `cutoff`, `debtopt`, `doctor`, `envelopes`, `forecaster`, `format`, `formula`, `lifeenergy`, `networth`, `paycycle`, `reconciler`, `report`, `timeline` (compiled CLI invoked via `GoBridgeService` + TypeScript parity mirrors in `apps/api/src/calculator/{erp-engines,hybrid-engine}.ts`).

### Website Verification Suite (Run on Every Web/API Fix per `AGENTS.md`)
1. `npm run erp:go:test`
2. `cd apps/api && npx jest --no-cache`
3. `npx tsx scripts/verify-zero-defect-erp.ts`
4. `npx tsx scripts/erp-bug-bounty.ts [--live]` / `npm run erp:pentest` / `npm run erp:email:e2e` / `npx tsx scripts/erp-ux-flow-e2e.ts [--live]`
5. Layer 5 Desktop Visual Browser QA (`read_file` screenshot inspection + zero dev-trace leakage + EN/ID/ZH parity).

---

## 4. Known Website Bugs & Open Queue (To Fix Next)

> **User signaled on `2026-11-23 21:05–21:13 +07:00`:** Web still has multiple bugs to review and fix end-to-end before resuming mobile.

### Already Confirmed Directly in Code (`2026-11-23`)
1. **`/admin` "Provision New Client Account" Modal Missing Password Field & Dropping Initial Salary (`User #4` incident):**
   - `apps/web/app/admin/page.tsx` (`createForm.tempPassword: "Password#2026"` at line `85`, modal JSX lines `1491–1632`) renders no password input field in UI, silently provisioning new users with `Password#2026`.
   - `apps/web/app/admin/page.tsx` (`184–185`) submits `initializeFirstPeriod` and `initialSalary`, but `apps/api/src/admin/dto/create-client.dto.ts` and `apps/api/src/admin/admin.service.ts` (`115–155`) ignore `initialSalary` (saving `baseSalary: 0`) and hardcode an empty `10/2026` snapshot (`finalTotalIncome: 0`).
   - Also check UX behavior after creating a client / switching accounts and check whether Web + Mobile need `SUPERADMIN` client-management clarity or clearer defaults.
2. **Additional Website Bugs (Awaiting User Walkthrough):**
   - Document and reproduce each reported bug with a failing TDD test (`RED`) before patching (`GREEN -> REFACTOR`).

---

## 5. Mobile App Pending Snapshot (`apps/mobile` + Phase 1 Mobile Backend)

Mobile development is **feature-complete through Phase 5 for Android & core flows**, verified on local emulator, and paused before physical device rollout & iOS CI setup.

### Completed & Committed (`dfce84c` + `de999e8`)
1. **Backend Mobile Hardening (`apps/api`, commit `dfce84c`):**
   - Prisma models: `RefreshToken` (opaque `sf_rt_*` family theft detection), `MobileDevice` (Ed25519/ECDSA P-256 SPKI key storage), `BiometricChallenge` (120s single-use nonce), `UserIdentity` (`GOOGLE`/`APPLE`/`OIDC` JWKS verification), `IdempotencyRecord` (24h deduplication + `409` payload mismatch).
   - Endpoints: `POST /api/auth/refresh`, `GET|DELETE /api/auth/sessions`, `POST /api/auth/logout-all`, `POST /api/auth/pin/setup|verify`, `POST|DELETE /api/auth/biometric/*`, `GET|POST|DELETE /api/auth/sso/*`, `GET /api/finance/mobile-boot`, `Idempotency-Key` interceptor on mobile financial mutations, `scripts/erp-mobile-e2e.ts`.
2. **Flutter App (`apps/mobile`, commit `de999e8`, `32` files in `lib/`, `11` test suites + `1` helper in `test/`):**
   - **Core:** Linear/Ramp/Mercury dark-slate theme (`#0C0E14` / `#161922`), `go_router` stateful 4-tab shell + push routes, `AppStrings` (`EN`/`ID`/`ZH`, zero jargon), `IdrFormatter` + Privacy Mask (`Rp •••••••`), `ApiClient` single-flight `401` refresh mutex + `Idempotency-Key`, `NdjsonStreamClient`, `BiometricAuthService` (Ed25519 + `local_auth`), `SecureVault`, shimmer skeletons & `2px` hairline sync bars.
   - **Screens Implemented:** `LoginScreen` (with inline EN/ID/ZH & `Try Demo Sandbox`), `UnlockScreen` (6-digit PIN + Biometrics, 45s auto-lock), `CockpitTab` (Mercury serif KPI, 3-state cycle, Priority Tiers, Payroll sheet, period switcher), `QuickLogSheet` (live cutoff simulation via `POST /api/finance/cutoff-simulate` + guarded expense submit), `RadarTab` (`CustomPaint` trajectory curve + trough, Wallet Check-In guard, `H-1` shift badge, Paid/Reserved/Unpaid controls), `MarqueeTab` (NDJSON streaming, Markdown inline formatting, step audit, 1-tap `pendingAction`, Memory Rules sheet), `MoreTab` (EN/ID/ZH toggle, Privacy Mask switch, Biometric enrollment, 6-digit Security PIN setup dialog, Sign Out), and push routes `LedgerScreen`, `SavingsScreen`, `WishlistScreen`.
   - **Android & Non-GMS Polish:** `FlutterFragmentActivity` in `MainActivity.kt`, `#0C0E14` launch splash (`colors.xml`, `launch_background.xml`, `styles.xml`), `0` GMS/Firebase deps in `pubspec.lock` (Huawei Non-GMS safe).
   - **Last Verified Checks (`de999e8`):**
     - `flutter analyze --fatal-infos --fatal-warnings`: `No issues found!`
     - `flutter test`: `26/26` passed across `360x780` & `430x932` viewports.
     - Built Release APK (`53,929,223` bytes / ~51.4 MiB): `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (points to `https://sundayfunday-api.vercel.app`, signed with debug key for internal review).
     - Layer 5 Emulator Screenshots (`Medium_Phone_API_36.1`) saved under `<appDataDir>/brain/ac73e91a-1a42-42ab-bd93-3b2b352acaab/mobile_qa/`.

### Pending / Remaining Mobile Backlog (Resume Later After Website Is Solid)
1. **Production Deployment Check:** Verify `apps/api` latest commits (`dfce84c` + Prisma schema migrations for `RefreshToken`/`MobileDevice`/`BiometricChallenge`/`UserIdentity`/`IdempotencyRecord`) are cleanly pushed & migrated on Neon Cloud / `sundayfunday-api.vercel.app` alongside latest `apps/web` fixes.
2. **Physical Device Review:** Install `app-release.apk` on physical Android phone; decide whether `LoginScreen` (`login_screen.dart:17`) should keep `'cheeseburger'` prefilled or leave `Account Name` blank/remembered for non-User#1 logins (such as User #4 `mei`/`meimeri`).
3. **iOS Distribution Pipeline:** `apps/mobile/ios` already has Bundle ID `id.sundayfunday.sundayfundayMobile`, min iOS `15.0`, and `NSFaceIDUsageDescription`, but needs cloud macOS CI (`Codemagic` or GitHub Actions `macos-latest`) to build `.ipa` (Sideloadly for free 7-day testing or TestFlight with Apple Developer account).
4. **Post-MVP Mobile Screens & Polish Scoped for Later:** Mobile `/payday-wizard` card checklist, `/reports` email statement dispatch screen, in-app Change Password dialog + SSO linking UI, localized strings in `MoreTab` dialogs/labels (`Cancel`/`Save PIN`/`Mask Balances`/`Language`), `flutter_local_notifications` scheduled `09:00 Asia/Jakarta` cutoff reminders, and Android production release keystore signing.

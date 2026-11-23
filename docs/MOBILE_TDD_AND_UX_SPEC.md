# Mobile UX, Transitions & TDD Specification (`MOBILE_TDD_AND_UX_SPEC.md`)

> **Design Objective:** Deliver the exact financial clarity, restraint, and domain behavior of the Sunday Funday V2 web ERP, tailored natively for one-handed iOS, Android, and Huawei (Non-GMS) daily usage—zero cramped desktop ports, zero generic AI-template visuals, and full 5-layer TDD verification.

---

## 1. Web-to-Mobile Screen & Menu Audit (`22` Web Routes Mapped)

All `22` routes in `apps/web/app/` map cleanly into **4 persistent bottom tabs**, **1 center `+` modal sheet**, **6 drilldown push pages**, and **6 desktop-only exclusions**:

| Web Route | Mobile Treatment | Mobile Location | Rationale |
| :--- | :--- | :--- | :--- |
| `/` (Overview) | **Keep & Rebuild Thumb-First** | Tab 1: `Cockpit` (`/cockpit`) | Hero Safe-to-Spend Today, 3-state cycle badge, Priority strip, Wallet Reconciliation. |
| `/allocations` (Waterfall & Pool) | **Merge Summary + Drilldown** | Tab 1 strip + `Cockpit -> Waterfall Detail` | Priority allocation breakdown (`Emergency Fund`, `Debt`, `Living Cash`, `Routine Bills`) without desktop sidebars. |
| `/payroll` (Salary Breakdown) | **Compact Card + Bottom Sheet** | Tab 1 summary card -> modal sheet | Shows Take-Home Net, Payday date, attendance & overtime without horizontal spreadsheets. |
| `/calendar` (Cash Radar) | **Mobile Timeline Strip** | Tab 2: `Radar` (`/radar`) | Scrollable daily event timeline, Lowest Cash Point trough, `H-1` shifted bills (`11th -> Friday`), SPayLater & Permata cutoff markers. |
| `/credit` (Matrix & Contracts) | **Trim Matrix Grid, Keep Operations** | Tab 2 segments (`Bills` / `Contracts`) + `+` Cutoff Simulator | Desktop `12-column` spreadsheet stays on web; mobile surfaces one-tap bill settlement, active installment progress, and purchase cutoff preview. |
| `/subscriptions` (Recurring CC) | **Merge into Radar** | Tab 2 segment (`Subscriptions`) | Recurring charges + Kill-Switch alerts ready at hand next to bills. |
| `/marquee` (+ `Alt+M` Drawer) | **Full Native Tab** | Tab 3: `Marquee` (`/marquee`) | Full-height SSE chat stream, expandable thinking telemetry rail, 1-tap `pendingAction` confirmation cards. |
| `/ledger` (Transactions) | **Push Screen** | `More` -> `/ledger` | Clean infinite scroll transaction history grouped by date + type filter chips (`All`, `Cash`, `PayLater`, `CC`, `Income`). |
| `/savings` (Pockets & Runway) | **Push Screen** | `More` -> `/savings` | Emergency Fund, RDPU reserve, Pocket balance cards, and confirm-deposit CTA. |
| `/wishlist` (DSR Affordability) | **Push Screen** | `More` -> `/wishlist` | Quick affordability check & DSR impact slider without multi-pane matrix clutter. |
| `/payday-wizard` (Cycle Close) | **Mobile Card Checklist** | `More` -> `/payday-wizard` | Step-by-step confirmation cards to close an active cycle safely with FaceID/Fingerprint guard. |
| `/reports` (KPI Summary & Email) | **Lite Summary + Email Trigger** | `More` -> `/reports` | Monthly KPI snapshot + sparkline trend + button to dispatch `.xlsx` / PDF statement to profile email (`POST /api/email/monthly-statement`). |
| `/preferences` (Studio) | **Trim to Mobile Settings** | `More` -> `/settings` | Keep Language (`EN`/`ID`/`ZH`), Privacy Mask default, Biometric Lock toggle, Local Notification time, Password Change, and Sign Out. |
| `/login` | **Auth Gate + Biometric** | `/login` & `/unlock` | Credentials + optional Security PIN, followed by OS FaceID/Fingerprint quick unlock on resume. |
| `/guide` | **Contextual Sheet** | `/settings` -> Terminology Sheet | Short plain-language definitions on demand without crowding navigation. |
| `/import`, `/scenarios`, `/audit`, `/admin`, `/admin/sql`, `/dev/components` | **Desktop-Only Excluded** | N/A | Heavy CSV multi-row reconcilers, multi-variable scenario sliders, full audit tables, Formula DSL IDE, and SQL Studio stay exclusively on desktop web. |

Quick action from anywhere in the 4-tab shell: **Center `+` Button** opens **Quick Log Sheet (`/log-expense`)** with segmented instrument switcher (`Living Cash`, `PayLater`, `Credit Card`, `Income`), debounced live Cutoff Landing badge (`POST /api/finance/cutoff-simulate`), and `Idempotency-Key` retry protection.

---

## 2. Native Mobile UX, Per-Route Transitions & Loading Architecture

To feel like a native financial application rather than a wrapped website, loading and navigation behavior differs strictly by route transition type:

| Navigation Pattern | Transition Curve | Loading Indicator (Never a Blank Spinner) | State Retention |
| :--- | :--- | :--- | :--- |
| **Bottom Tab Switch** (`Cockpit` / `Radar` / `Marquee` / `More`) | Instant switch with `140ms` subtle opacity cross-fade (`StatefulShellRoute.indexedStack`). | Zero full-screen reload on tab revisit; background SWR refresh updates deltas silently or pulls subtle inline dot indicator. | Scroll position & form drafts stay alive per tab. |
| **Drilldown Push** (`More` -> `/ledger`, `/savings`, `/wishlist`, `/payday-wizard`, `/reports`, `/settings`) | Native adaptive horizontal slide + edge-swipe back (`iOS Cupertino` / Android predictive back). | **Exact-geometry Dark-Slate Shimmer Skeleton** on first open + **pinned `2px` Top Hairline Progress Bar (`#10B78D`)** directly below the AppBar during SWR revalidation. | Disposes cleanly on pop back. |
| **Period Switch** (`Oct` <-> `Nov` <-> `Dec`) | Header chip morph + animated numeric interpolation (`TweenAnimationBuilder`). | Keep prior period layout rendered at `60%` opacity + top `2px` hairline sync bar (zero layout collapse/flash). | Syncs global Riverpod selected period across all tabs. |
| **Quick Log / Confirm Modal** (`/log-expense`, `pendingAction` confirm) | Bottom sheet slide (`260ms`, `Curves.easeOutCubic`), drag handle, keyboard `viewInsets` aware. | Submit button morphs cleanly (`Idle` -> compact inline ring -> checkmark + haptic -> auto-close in `450ms`). | Prevents double-tap via `Idempotency-Key` lock. |
| **Pull-to-Refresh** (`Cockpit`, `Radar`, `Ledger`, `Savings`) | OS stretch/bounce overscroll. | Custom `RefreshIndicator` (`#10B78D` arc on `#1D222E` disc) + `HapticFeedback.selectionClick()`. | Forces fresh network fetch & invalidates stale period slice. |
| **Marquee AI Co-Pilot** (`/marquee`) | Instant optimistic user message bubble append. | **Live SSE Thinking Rail** consuming `event: status` frames (`Reading cycle...`, `Simulating cutoff...`), smoothly expanding into formatted Markdown/action card. | Persists active session thread in memory until explicit clear. |

### Tactile & Native Ergonomics Rules
- **Haptic Language:** `selectionClick()` for tab/period selectors; `lightImpact()` for bill settlement toggles; `mediumImpact()` on transaction commit or payday close; `heavyImpact()` on `LOCKED` cycle rejection or `429` cooldown.
- **Touch Target Discipline:** Every clickable pill, toggle, header icon, and table row action enforces at least `48x48` logical dp hit area.
- **Visual Consistency (`Zero AI-Slop`):**
  - Strictly preserves `apps/web/app/globals.css`: `#0C0E14` canvas, `#161922` surface, `#1D222E` elevated surface, `#282E3D` 1px crisp borders, `#10B78D` emerald-teal positive, `#E06C53` terracotta/rust negative, `#E59B2C` muted amber caution, `#FF3838` urgent warning accent.
  - Zero emojis anywhere in copy, zero pastel circular icon wrappers, zero blur glassmorphism cards, zero generic white primary CTA buttons.
- **Offline / Spotty 4G Degradation:**
  - Read failures drop a slim `#E59B2C` amber banner (`Offline — showing last synced data`) above content without wiping cached numbers.
  - Mutation timeouts reuse the identical generated UUIDv4 `Idempotency-Key` so retrying never double-charges a PayLater or Cash transaction.

---

## 3. Recommended IDE Tooling & Emulator Inspection Setup

- **VS Code / Antigravity Extensions:**
  - `Dart-Code.flutter` + `Dart-Code.dart-code`: Dart static analyzer, hot reload (`r`), Flutter Widget Inspector, and Performance/Layout Explorer.
- **Local Visual Verification Setup:**
  - Local Android Virtual Device: **`Medium_Phone_API_36.1`** (verified in `ANDROID_HOME\emulator`).
  - Native inspection commands via Android CLI (`android screen` + `android layout` over `adb`) + `flutter test` golden/widget bounds checks so every screen passes real pixel inspection before shipping.

---

## 4. Five-Layer Mobile TDD & Quality Gate (`Red -> Green -> Refactor`)

Every phase (`Phase 1` through `Phase 5`) must pass all applicable layers before merging:

| Layer | Command / Tool | Scope & Non-Negotiable Assertions |
| :--- | :--- | :--- |
| **Layer 1 — Unit & Contract Tests** | `flutter test test/core test/unit` | Theme tokens match `globals.css`; `IdrFormatter` formats `id-ID`/`en-US` + Privacy Mask cleanly; `AppStrings` enforces 100% key parity across `EN`/`ID`/`ZH` and bans `Vault`/`Reservoir`/`Forward-Borrow`/`P1`/`P2`/emojis; `ApiClient` executes single-flight `401` refresh mutex (N concurrent calls -> 1 refresh), preserves `Idempotency-Key`, and maps `429` lockouts cleanly. |
| **Layer 2 — Widget, Viewport & Skeleton Tests** | `flutter test test/widgets` | Pump every screen across `EN`/`ID`/`ZH`, unlocked/privacy-masked, and `DRAFT`/`LOCKED` states at both small (`360x780`) and large (`430x932`) phone viewports asserting zero `RenderFlex overflow`, exact Skeleton Shimmer (no fullscreen centered spinner), proper hairline period-switch bar, and `>= 48dp` interactive targets. |
| **Layer 3 — Backend Parity & Sandbox Integration** | `cd apps/api && npx jest --no-cache` + live Demo Sandbox (`userId = 2`) | Verify `RefreshToken` rotation & replay revocation, `Idempotency-Key` deduplication (3 identical POSTs -> 1 ledger row), and `GET /api/finance/mobile-boot` returning byte-identical totals to `GET /api/snapshots` + `GET /api/finance/pacing`. |
| **Layer 4 — Static Analysis, Huawei Non-GMS Audit & Release Build** | `flutter analyze --fatal-infos --fatal-warnings` & `flutter build apk --release` | Zero lint warnings/infos; assert `pubspec.lock` and Android Gradle dependency graph contain **zero** `com.google.android.gms` / `play-services-*` / `firebase_*` bindings (guaranteed Huawei HarmonyOS/EMUI safety); clean release APK artifact. |
| **Layer 5 — Visual Emulator Screenshot & Layout QA** | Boot `Medium_Phone_API_36.1` + `android screen` + `android layout` + `read_file` | Inspect actual rendered pixels & widget tree across Login/Biometric, Cockpit, Quick Log, Radar, Marquee SSE, and More Hub in `EN`/`ID`/`ZH` + Privacy Mask mode; verify zero SafeArea/notch overlaps, crisp `#282E3D` borders, and exact ledger numbers matching web. |

---

## 5. Planned Test File Structure (`apps/mobile/test/`)

```text
apps/mobile/test/
├── core/
│   ├── api_client_and_env_test.dart       # [Done] Base URL, Bearer JWT, Idempotency-Key, 429 handling
│   ├── l10n_and_router_test.dart          # [Done + Expand] EN/ID/ZH parity, anti-slop guard, auth redirects
│   ├── theme_and_formatter_test.dart      # [Done + Expand] Palette parity, IdrFormatter, privacy mask
│   └── refresh_lock_idempotency_test.dart # [Phase 2] Single-flight 401 refresh mutex + timeout retry key reuse
├── widgets/
│   ├── skeleton_and_transitions_test.dart # [Phase 2-3] Hairline bar & shimmer geometry without overflow
│   ├── cockpit_screen_test.dart           # [Phase 3] 3-state pacing, LOCKED banner, 360px/430px viewports
│   ├── quick_log_sheet_test.dart          # [Phase 3] Instrument routing, cutoff preview, double-submit guard
│   ├── radar_bills_test.dart              # [Phase 4] Settlement toggle optimistic UI & trough highlight
│   └── marquee_stream_test.dart           # [Phase 5] SSE event:status progression & 1-tap confirm card
└── integration/
    └── sandbox_e2e_flow_test.dart         # [Phase 5] Demo Sandbox userId=2 login -> log -> settle -> clean reset
```

# Mobile Product Requirements Document (`MOBILE_PRD.md`) — Sunday Funday Pocket Cockpit

> **Rule of Scope:** Mobile (`apps/mobile`, Flutter) is a fast, thumb-first **Pocket Cockpit** for daily spending control, quick logging, due-date settlement, and Marquee AI commands. It is **never** a cramped 1:1 port of desktop setup studios (Formula DSL editor, 12-month full spreadsheet grid, Excel exports, SMTP raw config, or `/admin`).

---

## 1. Platform Targets & Compatibility Policy

- **Android (GMS):** Standard Android phones (Android 8.0+ / API 26+).
- **Huawei (Non-GMS / HarmonyOS / EMUI):** First-class support. Zero hard dependencies on Google Play Services (no Google Sign-In, no Firebase Auth, no Google Maps SDK). Notifications in V1 use OS-local scheduled triggers (`flutter_local_notifications`) + backend SMTP email alerts, avoiding mandatory Google FCM lock-in.
- **iOS (iPhone):** Supported via the identical Dart/Flutter codebase (`ios/` target), built from Windows via Cloud macOS CI (Codemagic / GitHub Actions `macos-latest`) -> TestFlight / App Store.

---

## 2. Core User Flows (4-Tab Pocket Cockpit + Quick Log Sheet + More Hub)

Keep bottom navigation uncluttered (4 primary tabs + center `+` sheet) while routing focused drilldowns cleanly through the `More` hub (full mapping in [`MOBILE_TDD_AND_UX_SPEC.md`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/docs/MOBILE_TDD_AND_UX_SPEC.md)):

| Screen / Route | Navigation Slot | Primary Job to Be Done | Authoritative API Endpoint(s) |
| :--- | :--- | :--- | :--- |
| **Login & Biometric Gate** (`/login`, `/unlock`) | Auth Gate | Sign in with `accountName` / `username` / `password` (+ Security PIN if untrusted IP), store tokens in `flutter_secure_storage`, unlock returning sessions via FaceID / Fingerprint. | `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me` |
| **Home Cockpit** (`/cockpit`) | Tab 1 | View live `Safe-to-Spend Today`, `3-state` cycle status (`PRE_PAYDAY` / `ACTIVE` / `COMPLETED`), Priority Tiers strip, Payroll pulse sheet, Wallet Guard check-in, and period switcher (`M/YYYY`). | `GET /api/snapshots/default-period`, `GET /api/finance/pacing`, `GET /api/snapshots` *(Phase 1 consolidated via `/api/finance/mobile-boot`)* |
| **Quick Log Expense Sheet** (`/log-expense`) | Center `+` Action Sheet | Log Cash, SPayLater, Permata CC, or Income in `< 5 seconds`. Preview exact cutoff landing cycle (`daysInMonth - 15` or `25th`) before committing. Supports **Idempotency-Key** against spotty 4G/5G retries. | `POST /api/finance/cutoff-simulate`, `POST /api/finance/transactions` |
| **Bills & Mini Cash Radar** (`/radar`) | Tab 2 | Mark active cycle liabilities settled/unsettled, inspect upcoming due dates (`11th H-1`, `17th`, `23rd`, `24th`, `25th`), view Lowest Cash Point trough, active contracts, and recurring CC subscriptions. | `GET /api/credit/line-items`, `PATCH /api/credit/line-items/:id/settlement-state`, `GET /api/finance/cash-radar` |
| **Marquee Co-Pilot** (`/marquee`) | Tab 3 | Conversational & tool-calling financial assistant (`EN`/`ID`/`ZH`) with real-time SSE thinking steps, 1-tap confirmation cards (`pendingAction`), and remembered routing rules. | `POST /api/marquee/chat/stream`, `POST /api/marquee/chat`, `GET|DELETE /api/marquee/memory` |
| **More Hub & Preferences** (`/more` -> `/ledger`, `/savings`, `/wishlist`, `/payday-wizard`, `/reports`, `/settings`) | Tab 4 + Push Routes | Focused mobile drilldowns for Transaction Ledger, Savings & Pockets, Wishlist DSR check, Payday Closing Checklist, Summary/Email Export, plus `EN`/`ID`/`ZH`, Privacy Mask, Biometric Lock, Local Reminders, and Sign Out. | `GET /api/finance/transactions`, `GET /api/savings/overview`, `POST /api/wishlist/analyze-draft`, `PATCH /api/auth/profile`, `POST /api/auth/logout` |

---

## 3. Non-Negotiable Financial & UX Invariants

1. **Zero Local Financial Math in Dart:** Flutter never computes payroll, waterfall tiers, daily safe-to-spend, TSR/DSR, or cutoff dates independently. All numbers are rendered verbatim from `apps/api`.
2. **Locked Period Safety:** If the selected cycle has `status == LOCKED`, write actions (log expense, settle toggles) display a clear read-only notice rather than failing silently.
3. **Human Copy & Visual Discipline (`Zero AI-Slop`):**
   - Preserve the Linear / Ramp / Mercury dark charcoal-slate visual identity (`#0C0E14` canvas, `#161922` surface, `#10B78D` emerald-teal positive deltas, `#E06C53` terracotta/rust negative urgency, `#E59B2C` muted amber caution, `#FF3838` critical urgency accent, serif centerpiece KPI numbers, and `tabular-nums` monospace everywhere else).
   - Zero emojis, zero pastel circle icon badges, zero glassmorphism blur cards, zero "Vault / Reservoir / P1 / P2 / Forward-Borrow" jargon leaks (`Savings & Emergency Fund` / `Tabungan & Dana Darurat` / `储蓄与应急基金`).
4. **Trilingual Parity (`EN` / `ID` / `ZH`):** Powered by Flutter ARB localization (`core/l10n/`) matching web dictionaries with zero hardcoded English leaks.
5. **Local Scheduled Notifications (Cross-Device Safe):** Remind at `09:00 Asia/Jakarta` before SPayLater dynamic cutoff (`daysInMonth - 15`), Permata CC statement closing (`25th`), and upcoming Payday — implemented purely via local device scheduling so Android, iOS, and Huawei behave identically.

---

## 4. Phased Build Roadmap (`Red -> Green -> Refactor` Strict Order)

1. **Phase 0 — Toolchain & Clean Project Setup:** Verify Flutter SDK, `flutter doctor`, `apps/mobile` scaffold, lint rules (`flutter_lints`), theme tokens, l10n scaffolding, and failing->passing foundation unit tests.
2. **Phase 1 — Backend Mobile Upgrades (`apps/api`):** Add `RefreshToken` persistence + rotation, `Idempotency-Key` guard on financial mutations, `GET /api/finance/mobile-boot`, and OpenAPI JSON schema export for Dart DTO parity.
3. **Phase 2 — Core Auth, Secure Vault & Dio Client (`apps/mobile`):** `flutter_secure_storage` + `local_auth` biometric gate + auto-refresh Dio interceptor + 429 rate-limit feedback.
4. **Phase 3 — Home Cockpit & Quick Log Expense:** Period cockpit, Safe-to-Spend hero card, quick expense modal with live cutoff preview & idempotency retry protection.
5. **Phase 4 — Bills & Mini Cash Radar + Local Reminders:** Line-item settlement toggle, Cash Radar timeline strip, and local scheduled cutoff reminders.
6. **Phase 5 — Marquee SSE Co-Pilot & Production Device Builds:** Streaming SSE chat bubbles, 1-tap `pendingAction` execution, Android/Huawei `.apk` build, and Codemagic `.ipa` TestFlight pipeline.

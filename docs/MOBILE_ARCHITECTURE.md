# Mobile Architecture Specification (`MOBILE_ARCHITECTURE.md`) — Flutter (`apps/mobile`)

This document governs code boundaries, state management, network transport, security storage, and CI build workflows for `apps/mobile` inside the `mondaymondayv2` monorepo.

---

## 1. High-Level Stack Decisions

| Concern | Choice | Rationale |
| :--- | :--- | :--- |
| **Framework & Language** | Flutter `3.50+` (Dart null-safe) | Pixel-identical rendering across Android, iOS, and Huawei Non-GMS; high-precision custom canvas/SVG charting. |
| **Architecture Pattern** | Feature-First Clean Slice + Repository | Eliminates cross-feature spaghetti; every screen reads typed immutable models from its feature controller. |
| **State Management** | `flutter_riverpod` | Compile-time safe DI, async loading/error states (`AsyncValue`), easy provider overrides in unit tests. |
| **Navigation** | `go_router` | Declarative URL/deep-link routing, auth/biometric redirect guards, stateful `StatefulShellRoute` bottom tabs. |
| **HTTP & Streaming** | `dio` + custom `sse_client` | Request/response interceptors for `Authorization: Bearer`, single-flight 401 refresh lock, `Idempotency-Key`, and SSE chunk parsing for Marquee. |
| **Secure Persistence** | `flutter_secure_storage` + `local_auth` | Hardware-backed Keychain (iOS) / Keystore (Android & Huawei) for tokens; OS biometric prompt on app resume. |
| **Testing & Quality** | `flutter test` + `flutter analyze` | Strict TDD (`Red -> Green -> Refactor`): pure Dart repository/formatter/notifier tests run in milliseconds without emulator overhead. |

---

## 2. Directory Layout (`apps/mobile/lib/`)

```text
apps/mobile/
├── pubspec.yaml                  # Workspace-isolated Dart dependencies & assets
├── analysis_options.yaml         # Strict lints (flutter_lints + avoid_print + prefer_const)
├── lib/
│   ├── main.dart                 # ProviderScope + ErrorWidget + MaterialApp.router
│   ├── app/
│   │   ├── app.dart              # Root theme, locale binding, lifecycle biometric lock listener
│   │   ├── router.dart           # GoRouter routes + auth redirect
│   │   └── theme.dart            # Linear/Ramp/Mercury dark charcoal/slate tokens (#0C0E14/#161922/#10B78D) & typography
│   ├── core/
│   │   ├── config/
│   │   │   └── env.dart          # API base URL (--dart-define=API_URL=https://sundayfunday-api.vercel.app)
│   │   ├── network/
│   │   │   ├── api_client.dart   # Dio wrapper + 401 single-flight refresh + 429 surface error
│   │   │   └── sse_client.dart   # Parse `event: status` / `data: ...` from POST /api/marquee/chat/stream
│   │   ├── storage/
│   │   │   └── secure_vault.dart # Token & preference persistence interface (mockable in tests)
│   │   ├── formatters/
│   │   │   └── idr_formatter.dart# Display-only Rp & date formatting + privacy masking ("Rp •••••••")
│   │   └── l10n/
│   │       └── app_strings.dart  # Deterministic EN / ID / ZH dictionary (migrates cleanly to ARB)
│   └── features/
│       ├── auth/
│       ├── cockpit/
│       ├── quick_log/
│       ├── bills_radar/
│       └── marquee/
└── test/                         # Mirrors core/ and features/ for strict TDD
```

---

## 3. Security, Token Lifecycle & Network Invariants

1. **Zero Native Hardcoded Secrets:** API host defaults to production `https://sundayfunday-api.vercel.app` and accepts `--dart-define=API_URL=http://10.0.2.2:3001` for Android emulator local debugging. Never bundle LLM keys, database URLs, or signing passwords inside Flutter code.
2. **Browser-Free CORS Behavior:** Native `dio` requests omit browser `Origin` headers; `apps/api/src/main.ts` permits non-origin requests while still enforcing strict JWT authentication on every route.
3. **Auth Header Discipline:** Always send `Authorization: Bearer <accessToken>`. Never send fallback `x-user-id` headers from mobile builds.
4. **Brute-Force Lockout Handling (`429 Too Many Requests`):** On HTTP `429`, UI disables the login button cleanly and surfaces a calm human cooldown notice (`Too many failed attempts. Wait 15 minutes before retrying.`) rather than spamming retries.
5. **Single-Flight Token Refresh (Phase 1 Target):** When an access token expires (`401`), `api_client.dart` queues concurrent requests under one `Completer` lock, executes one refresh call, updates `secure_vault.dart`, and replays failed requests cleanly.

---

## 4. Build & CI/CD Workflow (From Windows to Android, Huawei & iOS)

- **Daily Dev Loop (Windows Local):**
  1. Start Android AVD (`Medium_Phone_API_36.1`) or plug in Android/Huawei device over USB.
  2. Run unit & widget suite continuously: `flutter test`.
  3. Run static analysis before every commit: `flutter analyze`.
  4. Build shareable Android/Huawei APK: `flutter build apk --release --dart-define=API_URL=https://sundayfunday-api.vercel.app`.
- **iOS Build Loop (Without Local Mac):**
  1. Commit cleanly on feature branch / `main`.
  2. Cloud macOS runner (**Codemagic** or GitHub Actions `macos-latest`) runs `flutter test`, `flutter analyze`, and `flutter build ipa --release`.
  3. Automatic distribution to iPhone via **TestFlight** (using Apple Developer App Store Connect API Key).

---

## 5. Monorepo Coexistence Rules (`npm` Workspaces vs `flutter`)

- `apps/mobile` does **not** include a `package.json`, ensuring root `npm` workspaces (`apps/*`) stay focused on Node services (`apps/api`, `apps/web`) without npm install conflicts.
- All mobile documentation stays cleanly consolidated under [`docs/MOBILE_PRD.md`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/docs/MOBILE_PRD.md), [`docs/MOBILE_ARCHITECTURE.md`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/docs/MOBILE_ARCHITECTURE.md), [`docs/MOBILE_TDD_AND_UX_SPEC.md`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/docs/MOBILE_TDD_AND_UX_SPEC.md), and [`docs/ERD_AND_MOBILE_API_CONTRACT.md`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/docs/ERD_AND_MOBILE_API_CONTRACT.md).

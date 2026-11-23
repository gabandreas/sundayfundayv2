# Mobile Client API Contract & Hardened Multi-Tenant ERD Reference

This document specifies the production API surface, authentication and rate-limiting rules, financial invariants, and hardened PostgreSQL entity schema for the upcoming Sunday Funday mobile companion / native application.

---

## 1. Base URL, Transport & Authentication Contract

- **Production API Origin:** `https://sundayfunday-api.vercel.app`
- **CORS Policy (`apps/api/src/main.ts`):**
  - Browser requests are strictly restricted to `sundayfunday*.vercel.app` origins and explicit localhost development ports (`http://localhost:3000`, `http://127.0.0.1:3000`).
  - Native mobile HTTP clients (iOS / Android / React Native / Flutter) that omit the browser `Origin` header are accepted normally, while authentication is always enforced by JWT.
- **JWT Bearer Authentication:**
  - `POST /api/auth/login` accepts `{ accountName?, username?, email?, password, securityPin?, trustIp? }` and returns `{ accessToken, expiresIn: 1800, user }`.
  - Passwords are verified strictly via salted `scryptv2` hashes (`crypto.timingSafeEqual`).
  - Include `Authorization: Bearer <accessToken>` on every authenticated request.
  - Refresh before expiry (30-minute TTL) via `POST /api/auth/refresh`.
  - Do not send static fallback `x-user-id` headers in mobile clients; server resolves identity strictly from verified JWT `sub`.
- **Distributed Brute-Force Rate Limiting (`AuthRateLimit`):**
  - Enforced persistently in PostgreSQL via `RateLimiterService.checkAsync` / `recordFailureAsync` / `recordSuccessAsync` (`5` consecutive failed login/verify attempts per `(identifier, normalizedIp)` within a `15`-minute window triggers `429 Too Many Requests` for `15` minutes across all serverless instances).
- **Security Headers:** All API responses emit `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 2. Hardened Multi-Tenant ERD Overview (`apps/api/prisma/schema.prisma`)

Every tenant-owned model stores an indexed `userId` foreign key referencing `User(id)` with `ON DELETE CASCADE`:

| Table | Tenant Scoping | Key Indexes / Uniques | Purpose |
| :--- | :--- | :--- | :--- |
| `User` | Root Identity (`id`) | `email` (UK), `(accountName, username)` (UK) | Consumer (`USER`), Sandbox (`DEMO_SANDBOX`), Admin (`SUPERADMIN`) |
| `TrustedIpAddress` | `userId -> User` | `@@index([userId])` | Trusted device/IP allowlist for high-security login |
| `GlobalConfig` | `userId -> User` | `userId` (UK) | Salary baseline, `creditStatementDay` (`@default(25)`), `creditDueDay` (`@default(11)`), `payrollPayoutDay` (`@default(25)`), modular studio rules & encrypted AI settings |
| `MonthlySnapshot` | `userId -> User` | `(userId, month, year)` (UK), `@@index([userId])` | Paycycle totals, `status` (`DRAFT` / `LOCKED`), `payrollPayoutDate`, override locks (`isManualOverride`, `lockedP1`, `lockedP2`) |
| `Transaction` | via `MonthlySnapshot(snapshotId)` | `@@index([snapshotId])`, `@@index([date])` | Paycycle income, deductions, daily spending & routine bill realizations |
| `BudgetRevision` | via `MonthlySnapshot(snapshotId)` | `@@index([snapshotId])` | Append-only audit log of mid-cycle budget edits (`isOneOff`, `oneOffLabel`) |
| `CreditContract` | `userId -> User` | `@@index([userId])` | Standalone installment contracts (`remainingTenor` decremented only on explicit period close) |
| `ScheduledBill` | `userId -> User` | `@@index([userId])` | Recurring fixed standing bills per due day |
| `CreditCardTransaction` | `userId -> User` | `@@index([userId])`, `@@index([userId, status])` | Full, installment, and recurring card charges + kill-switch dates |
| `MonthlyBulkBill` | `userId -> User` | `(userId, month, year)` (UK), `@@index([userId, year, month])` | Monthly PayLater, Personal Debt, and Card aggregates |
| `LiabilityLineItem` | `userId -> User` | `@@index([userId, year, month])`, `@@index([parentContractId])` | Itemized debt slices reconciled 1:1 with `MonthlyBulkBill` |
| `SavingsManualTransaction` | `userId -> User` | `@@index([userId])` | Core Savings / Emergency Fund (`LIQUID_CASH` / `INVESTMENT_RDPU`) entries |
| `SavingsGoal` | `userId -> User` | `@@index([userId])` | Allocated savings pockets & goal milestones |
| `WishlistItem` | `userId -> User` | `@@index([userId])` | Planned purchases with DSR & installment affordability analysis |
| `AuditLog` | `userId -> User` | `@@index([userId])` | Categorized mutation & compliance trail |
| `CustomFeatureRequest` | `userId -> User` | `@@index([userId])` | User-submitted custom rule / module requests |
| `AuthRateLimit` | Global `(key)` PK | `@@index([lockedUntil])` | Serverless brute-force attempt counter & lockout window |

Full Mermaid schema details are maintained in [`docs/ERD.md`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/docs/ERD.md).

---

## 3. Financial Calculation & Temporal Rules for Mobile Views

Mobile clients **must never re-implement** payroll, waterfall, pacing, or cutoff formulas locally. Display values returned by the NestJS / Go backend as the single source of truth:

1. **Payday-to-Payday Consumption Window:** Period `M/YYYY` runs from `Payday(M-1)` through the day before `Payday(M)` and settles bills whose due date falls in calendar month `M`.
2. **3-State Daily Pacing (`PRE_PAYDAY` | `ACTIVE` | `COMPLETED`):**
   - `PRE_PAYDAY`: Display countdown (`daysUntilCycleStart`) and projected daily rate; do not show burn-rate deficit alerts before payday.
   - `ACTIVE`: Display `safeToSpendToday`, weekday/weekend weighted targets, and `paceDeltaRp`.
   - `COMPLETED`: Freeze `safeToSpendToday = 0` and `daysRemaining = 0`.
3. **Configurable Instrument Cutoffs:**
   - **SPayLater (`dueDay = 25`):** Default dynamic formula `DAYS_IN_MONTH - 15` (`15th` in 30-day months, `16th` in 31-day months, clamped cleanly in Feb 28/29).
   - **Permata Credit Card (`dueDay = 11` + `H-1` business-day shift):** Fixed `creditStatementDay` (`25th`); due dates on Saturday/Sunday shift to preceding Friday (`e.g. 2027-04-09`).
   - Always honor custom per-instrument `cutoffFormula` and `preCutoffOffsetMonths` returned by `GET /api/config`.
4. **Locked Period Immutability:** Historical `LOCKED` periods reject mutations; show a read-only indicator and guide edits toward the active `DRAFT` period or explicit `POST /api/snapshots/:id/reopen`.

---

## 4. Mobile API Endpoint Inventory

### A. Auth & Profile (`/api/auth`)
- `POST /api/auth/login` — Authenticate and receive JWT + user metadata
- `POST /api/auth/verify-password` — Re-authenticate before sensitive actions
- `POST /api/auth/refresh` — Rotate active JWT
- `GET /api/auth/session` — Lightweight session probe
- `GET /api/auth/me` — Current user profile, role, blueprint & density settings
- `PATCH /api/auth/profile` — Update `email` / `fullName`
- `POST /api/auth/change-password` — Rotate password (`scryptv2`)
- `POST /api/auth/demo-login` / `POST /api/auth/reset-demo` — Sandbox evaluation session
- `POST /api/auth/logout` — End client session

### B. Paycycle Cockpit, Overview & Pacing (`/api/snapshots`, `/api/finance`)
- `GET /api/snapshots/default-period` — Resolve user's landing `(month, year)` (`EARLIEST_OPEN_ACTIVE` vs `CALENDAR_WINDOW`)
- `GET /api/snapshots?month=&year=` — Resolve/read single paycycle snapshot
- `GET /api/snapshots/horizon?startMonth=&startYear=&count=` — Batch 12-month horizon summary
- `POST /api/snapshots/:id/budget-revision` / `POST /api/snapshots/:id/budget-revision/preview` — Mid-cycle target edits + 1-off labels
- `POST /api/snapshots/:id/borrow-p1` — Temporary Savings Advance from P1 reserve
- `POST /api/snapshots/:id/close` / `POST /api/snapshots/:id/reopen` / `POST /api/snapshots/:id/recalculate`
- `GET /api/finance/pacing?month=&year=` — Live 3-state daily pacing, safe-to-spend & burn metrics
- `GET /api/finance/cash-radar?month=&year=` — Daily cashflow events + Lowest Cash Point trough (`radar.go` parity)
- `GET /api/finance/transactions?month=&year=` — Cycle transaction ledger
- `POST /api/finance/transactions` — Record cash expense, income, or auto-routed `PAYLATER` / `CC` charge
- `PATCH /api/finance/transactions/:id` / `DELETE /api/finance/transactions/:id`
- `POST /api/finance/cutoff-simulate` — Simulate instrument cutoff placement & DSR impact prior to spend
- `GET /api/finance/wallet-guard?month=&year=` & `POST /api/finance/wallet-guard` — Bank balance check-in vs unpaid bills
- `GET /api/finance/payroll-horizon` / `GET /api/finance/payroll` — Paycheck breakdown & working-day cutoff metrics
- `GET /api/finance/intelligence` / `POST /api/finance/scenarios/simulate` / `POST /api/finance/formula/evaluate`

### C. Credit, Bills, Savings & Wishlist (`/api/credit`, `/api/bills`, `/api/savings`, `/api/wishlist`)
- `GET /api/credit/matrix` — 12-month rolling liability matrix & active contract timelines
- `GET /api/credit/installment-plans` — Active multi-month installment schedules
- `GET /api/credit/line-items`, `POST /api/credit/line-items`, `POST /api/credit/line-items/:id/shift`, `PATCH /api/credit/line-items/:id/settlement-state`, `PATCH /api/credit/line-items/settle-bulk`, `DELETE /api/credit/line-items/:id`
- `GET /api/credit/cards`, `POST /api/credit/cards`, `PATCH /api/credit/cards/:id`, `POST /api/credit/cards/:id/settle-early`
- `GET /api/credit/contracts`, `POST /api/credit/contracts`, `PUT /api/credit/contracts/:id`, `DELETE /api/credit/contracts/:id`
- `POST /api/credit/bridge-loan`, `POST /api/credit/bridge-loan/accelerate`
- `GET /api/bills`, `POST /api/bills`, `DELETE /api/bills/:id`
- `GET /api/savings/overview`, `PUT /api/savings/pockets`, `POST /api/savings/confirm-period-deposit`, `POST /api/savings/wealth-target`, `GET|POST|PATCH|DELETE /api/savings/goals`
- `GET|POST|PATCH|DELETE /api/wishlist`, `POST /api/wishlist/analyze-draft`, `POST /api/wishlist/:id/convert-to-contract`

### D. Marquee AI Co-Pilot, Streaming, Shortcut Webhook & MCP (`/api/marquee`)
- `POST /api/marquee/chat` — Standard JSON turn (Tier 1 `<5ms` NLU fallback or Tier 2 bounded 4-hop ReAct tool loop)
- `POST /api/marquee/chat/stream` — Server-Sent Events (`status` telemetry frames + final payload for real-time mobile typing/thinking states)
- `GET /api/marquee/memory`, `DELETE /api/marquee/memory/:id` — Persistent user financial preference rules
- `GET /api/marquee/config`, `PUT /api/marquee/config`, `POST /api/marquee/webhook-token/rotate`
- `POST /api/marquee/webhook` — Headless quick-capture (`X-Marquee-Token` header; iOS Shortcuts / Android Tasker ready)
- `POST /api/marquee/mcp` — Authenticated JSON-RPC 2.0 MCP endpoint (`15` curated ERP tools; zero raw SQL or shell execution)

### E. Analytics, Reports, Preferences & Tenant Backup (`/api/analytics`, `/api/reports`, `/api/config`)
- `GET /api/analytics` — Category spending velocity & period comparisons
- `GET /api/reports`, `GET /api/reports/forecast`, `GET /api/reports/executive-horizon`
- `GET /api/config`, `POST /api/config`, `PATCH /api/config/studio`, `GET /api/config/backup` (strictly `userId`-scoped with SMTP/WA secrets redacted)
- `POST /api/config/restore`, `PATCH|DELETE /api/config/custom-requests/:id` (strictly `SUPERADMIN` via `PlatformOwnerGuard`)

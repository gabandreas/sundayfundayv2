# Sunday Funday ERP (V2)

Deterministic Personal Finance & Cashflow Allocation Engine

Sunday Funday is a multi-tenant personal finance ERP system designed for disciplined cashflow management, daily operational spend pacing, credit card billing cycle materialization, and financial audit verification.

The application is structured as a TypeScript monorepo combining a NestJS business logic service with a Next.js App Router presentation layer and PostgreSQL persistence.

---

## 1. Live Portfolio Sandbox Access

Technical evaluators and recruiters can access an isolated demonstration sandbox without configuring local dependencies.

| Parameter | Value |
|---|---|
| **Login URL** | `/login` |
| **Account Name** | `portfolio` |
| **Username** | `recruiter` |
| **Password** | `Recruiter2026!` |
| **Direct 1-Click Access** | Click **"Explore Portfolio Sandbox (Recruiter Demo) →"** on `/login` |
| **Role & Scope** | `DEMO_SANDBOX` (`userId = 2`, isolated from production records) |

### Testable Technical Workflows
- **Financial Privacy Masking:** Financial amounts initialize masked as `Rp •••••••`. Click the topbar **Reveal** button and verify with password `Recruiter2026!` to unmask figures in real time.
- **Dynamic Spend Pacing:** Inspect the payday-to-payday variable consumption window (`28 Oct – 26 Nov 2026`), daily burn rate gauges, and status transitions (`ON_TRACK`, `CAUTION`, `BURNING_FAST`).
- **10-Second Balance Reconciler:** Execute real-time bank balance checkpoints with automated surplus allocation or deficit absorption against the operational pool.
- **Credit Card Billing Cycle Engine:** Review credit statement cutoff versus due-date mapping across 12-month amortized liability projections.
- **Subscription Promo Kill-Switch:** Manage recurring service expirations and auto-renew cutoff triggers.

---

## 2. Core Engineering Architecture

```
mondaymondayv2/
├── apps/
│   ├── api/                 # NestJS calculation service & database transactions
│   │   ├── prisma/          # Prisma schema, migrations, and model definitions
│   │   ├── src/
│   │   │   ├── admin/       # Backup/restore engine & SQL query studio
│   │   │   ├── auth/        # 3-field auth, rate limiting, and session verification
│   │   │   ├── calculator/  # Deterministic integer financial mathematics
│   │   │   ├── credit/      # Credit card billing cycle & amortization models
│   │   │   └── ...
│   │   └── test/            # Isolated E2E test suites (finance_erp_test)
│   └── web/                 # Next.js 14 presentation layer (App Router)
│       ├── app/             # 18 client and server routes
│       ├── components/      # Design system primitives & domain panels
│       ├── context/         # Auth, Perspective, and Privacy Mask providers
│       └── lib/             # API transport clients and formatters
└── packages/
    └── shared/              # Shared TypeScript contracts and constants
```

### Multi-Tenant Data Isolation
- **Tenant Scope:** Every persistent record binds to a `userId`. All repository queries enforce explicit `where: { userId }` filters at the service layer.
- **Role-Based Access Control (4 Tiers):**
  - `PLATFORM_OWNER` (`userId = 1`): Full system control, client provisioning, and `/admin/sql` query studio access.
  - `BESPOKE_CLIENT`: Dedicated custom rule and routine envelope configurations.
  - `STANDARD_MEMBER`: Standard budgeting configurations.
  - `DEMO_SANDBOX` (`userId = 2`): Isolated environment restricted from administrative endpoints.
- **Session Lifecycle:** 30-minute JWT token lifetime (`exp: 1800s`). Tokens are validated via `AuthMiddleware` and automatically refreshable. Expired sessions preserve non-sensitive account metadata in `localStorage` (`erp_locked_identity`) for fast single-field password re-authentication.

### Deterministic Calculation Engine
- **Integer Arithmetic:** All monetary transactions and calculations are performed in whole Indonesian Rupiah (IDR integers) to eliminate IEEE-754 floating-point drift.
- **4 Configurable Allocation Engines:**
  - `DEBT_FIRST_WATERFALL`: Aggressively services debt liabilities before allocating operational spending and savings.
  - `SAVINGS_FIRST_LOCK`: Locks savings targets immediately upon paycheck arrival.
  - `PERCENTAGE_SPLIT`: Proportional division across Needs (50%), Wants (30%), and Savings (20%).
  - `RETIREMENT_DRAWDOWN`: Preserves capital base with safe monthly withdrawal limits.

### Credit Card Statement Cycle Materialization
- Accounts for the structural lag between credit card transaction dates, statement closing dates, and payment due dates.
- Charges incurred before the statement cutoff day are materialized into the active period liability pool; charges after the cutoff roll into the subsequent period liability pool.
- Subscription state machine tracks promotional end dates, projecting post-promo rate step-ups and enforcing cancellation deadlines before automated renewals trigger.

### Security & Operational Tooling
- **Brute-Force Rate Limiting:** In-memory sliding-window limiter locks authentication attempts after 5 consecutive failures for 15 minutes per identifier/IP pair.
- **Client IP Extraction:** Resolves real client addresses through edge reverse proxies via priority order: `cf-connecting-ip` -> `x-forwarded-for` -> `x-real-ip` -> remote address.
- **Atomic Database Backup/Restore:** Exports and imports complete database state in JSON format within a single atomic PostgreSQL `$transaction`, realigning database primary key sequences automatically.
- **Superadmin SQL Studio (`/admin/sql`):** In-browser query console supporting `READ_ONLY` transaction guards, `DRY_RUN_ROLLBACK` test execution, and full table inspection.

---

## 3. Local Development & Testing

### Prerequisites
- Node.js 20.x or higher
- Docker & Docker Compose
- PostgreSQL 16 (or Docker container)

### Setup Instructions
```bash
# 1. Install dependencies across all workspaces
npm install

# 2. Start PostgreSQL container (port 5433)
docker compose up -d

# 3. Apply schema to test database
cd apps/api
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5433/finance_erp_test?schema=public" npx prisma db push
cd ../..

# 4. Start development servers (API: 3001, Web: 3000)
npm run dev
```

### Running Test Suites
All automated tests execute against `finance_erp_test` to prevent side effects on live records.

```bash
# Run backend calculation unit tests (14 suites, 122+ tests)
npm run test --workspace=apps/api

# Run isolated end-to-end integration tests
npm run test:e2e --workspace=apps/api

# Run frontend production build & TypeScript validation
npm run build --workspace=apps/web
```

---

## 4. Production Deployment Topology

The application is architected for zero-cost deployment on cloud free tiers:

- **Database:** Serverless PostgreSQL on [Neon.tech](https://neon.tech)
- **API Service:** Containerized NestJS on [Koyeb](https://koyeb.com) or [Render](https://render.com)
- **Web Interface:** Next.js on [Vercel](https://vercel.com)

Detailed deployment configuration, environment variables, and verification steps are documented in [DEPLOYMENT.md](DEPLOYMENT.md).

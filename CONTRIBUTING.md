# CONTRIBUTING.md — Development Workflow & Quality Standards

Engineering conventions and workflow for this monorepo. Read `AGENTS.md` and `ARCHITECTURE.md` first — this document is about *how* you work, those are about *what* you build.

---

## 1. Ground Rules

1. Strictly adhere to `AGENTS.md` — no AI-guessable defaults, no marketing copy, no emoji, no layering violations.
2. Keep controllers thin, business logic in services, reads in selectors — see `AGENTS.md` §Architecture & Layering.
3. Never touch a calculation formula without being explicitly told to. If something looks wrong, flag it in a comment or a message, don't quietly "fix" it.

---

## 2. Repo Layout
/
├── apps/
│ ├── web/ # Next.js frontend
│ └── api/ # NestJS backend
├── packages/
│ └── types/ # Shared TypeScript types/DTOs used by both apps, if needed
└── package.json # Workspace root


Single Postgres database, owned entirely by `apps/api` via Prisma. `apps/web` never talks to the database directly — everything goes through the API.

---

## 3. Running the Project

```bash
# Install dependencies (run once, at the workspace root)
npm install

# Run both apps in dev mode
npm run dev --workspace=apps/api
npm run dev --workspace=apps/web

# Prisma — run from apps/api
npx prisma migrate dev --name <description>
npx prisma studio
```

No Docker requirement — this is a local, single-user app. Postgres can run natively or via a single lightweight container; either is fine, but don't introduce a multi-container orchestration setup for a project this size.

---

## 4. Code Style & Quality

### Linting & Formatting
```bash
# From workspace root, or scoped to one app
npm run lint --workspace=apps/api
npm run lint --workspace=apps/web
npm run format
```
- ESLint + Prettier across both apps, one shared config at the root so `apps/web` and `apps/api` don't drift into inconsistent style.
- No `any` in TypeScript unless there is genuinely no better option — and if used, comment why.

### Type Safety
- DTOs on the backend (`class-validator`) and their frontend-facing shapes should not silently diverge. If a shared type package (`packages/types`) exists, use it instead of duplicating an interface on both sides.

---

## 5. Git & Commit Conventions

Conventional Commits, no emojis, lowercase description.

Format: `<type>(<scope>): <description>`

Types:
- `feat` — a new feature or endpoint
- `fix` — a bug fix or calculation correction
- `refactor` — reorganization without behavior change
- `perf` — query/index/latency optimization
- `style` — visual/CSS-only change, no logic change
- `test` — adding or correcting tests
- `chore` — dependency bumps, config, tooling

Examples:
- `feat(waterfall): add priority-4 surplus overflow to self-reward`
- `fix(calculator): remove duplicate credit installment deduction`
- `refactor(snapshots): replace lazy tenor mutation with explicit close-period action`
- `style(dashboard): rework card typography per visual direction spec`

---

## 6. Testing

- Backend: unit tests for everything in `calculator/` — these are pure functions with financial consequences, they get the most test coverage in the repo. Golden test: recreate the 4 known V1 bugs as regression tests (double-counted installment, tenor mutation on read, double-counted windfall income, mismatched discipline score formulas) so they can never silently come back.
- Selectors and services: integration tests against a test database, not mocked Prisma calls, since spatial-adjacent bugs in this codebase (well — financial-adjacent) tend to hide in the query logic itself.
- Frontend: component tests only where there's real logic (form validation, derived display values) — don't write tests for pure layout.

```bash
npm run test --workspace=apps/api
npm run test --workspace=apps/web
```

---

## 7. What Not To Do

- Do not sum a liability, income source, or deduction from more than one place.
- Do not mutate a database row inside a GET handler or a Server Component data fetch.
- Do not add a second formula for a metric that already has one.
- Do not introduce global client state (Redux, Zustand, etc.) unless a specific, named problem requires it — URL state and Server Component fetching cover this app's actual needs.
- Do not build a mobile/responsive layout.
- Do not commit `.env` files or credentials.
# Architecture & UX Flow — Sunday Funday ERP V2.5

## 1. End-to-End Request & Engine Topology

```mermaid
flowchart TD
    subgraph Client["apps/web (Next.js 16 App Router · Desktop ERP)"]
        SSR["Server Components + Smart Default Active Period"]
        CTX["PeriodContext + usePeriodSlice (<2ms SWR Cache)"]
        UI["12 Consolidated Modules + Alt+M Marquee <dialog> Drawer"]
    end

    subgraph API["apps/api (NestJS 11 · Strictly Layered)"]
        AUTH["AuthMiddleware + PlatformOwnerGuard (role === SUPERADMIN)"]
        CTRL["Controllers (/api/* · DTO Validation Only)"]
        SEL["Selectors (Read-Only Queries · Zero Mutations)"]
        SVC["Services (Atomic Prisma Transactions + AuditLog)"]
        MRQ["Marquee 3-Tier Co-Pilot (Tier 1 NLU -> Tier 2 LLM -> 8 Tools)"]
    end

    subgraph Math["Authoritative Financial Math (Zero Drift)"]
        CALC["apps/api/src/calculator/* (TypeScript Calculators)"]
        GOBRIDGE["GoBridgeService"]
        GOBIN["apps/go-engine/bin/go-engine (13 Native Go Packages)"]
    end

    subgraph Storage["PostgreSQL Storage Layer"]
        NEON["Neon Cloud PostgreSQL (Primary Production)"]
        LOCAL["Local PostgreSQL 127.0.0.1:5433 (Mirrored via erp:sync)"]
    end

    SSR --> CTRL
    CTX --> CTRL
    UI --> CTRL
    CTRL --> AUTH
    AUTH --> SEL
    AUTH --> SVC
    AUTH --> MRQ
    MRQ --> SEL
    MRQ --> SVC
    SEL --> CALC
    SVC --> CALC
    CALC <--> GOBRIDGE
    GOBRIDGE <--> GOBIN
    SEL --> NEON
    SVC --> NEON
    NEON -. "npm run erp:sync" .-> LOCAL
```

---

## 2. User Journey & Paycycle Lifecycle Flow

```mermaid
flowchart LR
    Landing["1. Smart Default Period Landing (/api/snapshots/default-period)"] --> PrePayday["2. PRE_PAYDAY State (Countdown + Bridge Callout)"]
    PrePayday --> Wizard["3. Payday & Closing Wizard (/payday-wizard)"]
    Wizard --> Step1["Step 1: Confirm Paycheck & Working Days"]
    Step1 --> Step2["Step 2: Lock Prior Cycle (closeSnapshot)"]
    Step2 --> Step3["Step 3: Settle Due-Date Bills (11th CC / 25th PayLater)"]
    Step3 --> Step4["Step 4: Confirm P1 Vault Deposit & Release Living Pool"]
    Step4 --> Active["4. ACTIVE Daily Pacing & Cash Radar (/ & /calendar)"]
    Active --> Capture["5. Daily Capture (Overview Form / Alt+M Marquee / Webhook)"]
    Capture --> Reports["6. Executive Statements & 4-Sheet Excel Dispatch (/reports)"]
```

---

## 3. Role Isolation & Security Architecture

| Account | Username | Role | Blueprint | `/admin` & `/admin/sql` Access | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User #1 (Gabriel)** | `cheeseburger` | `USER` | `SUPERADMIN_BESPOKE` | **Denied (`403 Forbidden`)** | Live production personal finance workspace (`userId = 1`). |
| **User #2 (Demo)** | `guest` | `DEMO_SANDBOX` | `STANDARD_GENERAL` | **Denied (`403 Forbidden`)** | Public evaluation sandbox & destructive E2E mutation target (`userId = 2`). |
| **System Superadmin** | `superadmin` | `SUPERADMIN` | `SUPERADMIN_BESPOKE` | **Granted (`200 OK`)** | Dedicated platform administration, tenant provisioning, and SQL Studio. |

---

## 4. Top-Layer `<dialog>` Drawer & Zero-Jank Tab Architecture

1. **Instant Sub-Module Switching (`syncSubInUrl` & `.tab-panel`):**
   - Intra-route sub-module navigation (`/credit?sub=contracts`, `/reports?sub=audit`, `/preferences?sub=ai`) updates URL parameters via `window.history.pushState` and dispatches `erp:sub-change`, switching panels in `<10ms` without triggering a Next.js `_rsc` roundtrip.
2. **Native Top-Layer `<dialog>` Drawer (`MarqueeCoPilotDrawer.tsx`):**
   - Uses native `<dialog>` with `showModal()`, `aria-labelledby`, `dialog:modal { overscroll-behavior: contain }`, and `dialog::backdrop { overflow: hidden; overscroll-behavior: contain }` — avoiding `html`/`body` overflow mutation layout shifts.
   - Outside-click light dismissal checks both `pointerdown` and `pointerup` coordinates against `getBoundingClientRect()` so text-selection drags never accidentally dismiss the drawer.

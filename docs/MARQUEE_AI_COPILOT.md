# Marquee AI Co-Pilot & Quick-Capture Specification

Marquee is Sunday Funday ERP's 3-tier deterministic, context-hydrated financial co-pilot and quick-capture engine (`apps/api/src/marquee/`, `apps/web/components/marquee/`).

---

## 1. Guiding Principle: Full Ledger Hydration + Zero Hallucinated Math

Large language models must **never** invent Rupiah balances, Debt Service Ratios (DSR), cutoff dates, or waterfall allocations in free text. On every turn:
1. **`MarqueeContextHydrator` (`apps/api/src/marquee/marquee-context.service.ts`)** hydrates the authenticated user's live, `userId`-isolated state:
   - Active paycycle & temporal state (`PRE_PAYDAY` / `ACTIVE` / `COMPLETED`, days until payday, two-stage payday law: `25th attendance & payslip cutoff + H+2 working days transfer`),
   - Multi-cycle snapshots (`10/2026..03/2027` income, total debt, funded living pool, uncovered shortfall, P1 Core Vault, P2 buffer),
   - Due-day calendar (`[8, 11, 17, 23, 24, 25]` and cutoff rules: SPayLater `15th -> 25th`, Credit Card `20th -> 11th`),
   - Installment payoff milestones (`JAN '27` 11.11 3x plans retire, `FEB '27` SPinjam reaches `Rp 0`, `SEP '27` final 12x card installment matures),
   - Active UI route & sub-tab context (`activeRoute`, `activeSubTab`, `locale`).
2. User intent is resolved either by **Tier 1** (deterministic in-process trilingual NLU in `<5ms`) or **Tier 2** (encrypted BYOK tool-calling via **DeepSeek** `deepseek-chat` / `deepseek-reasoner`, **OpenCode** `opencode-chat`, **Google Gemini** `gemini-3.8-flash` via `@google/genai`, or **Groq** `llama-3.3-70b-versatile`).
3. The resolved intent executes one of **8 canonical deterministic tools** in `MarqueeToolsService`, returning exact figures and human-written explanations obeying the 6 Human Writing Laws.

---

## 2. Three-Tier Architecture & Provider Matrix

### Tier 1 — Zero-Latency Trilingual Deterministic NLU (`marquee-nlu.ts`)
- Works out of the box with **zero external API keys** and **zero network latency**.
- Understands English (`EN`), Bahasa Indonesia (`ID`), and Simplified Chinese (`ZH`).
- Parses Indonesian Rupiah shorthands (`45k`, `85rb`, `85 ribu`, `1.5jt`, `1,5 juta`, `Rp 75.000`, `5万`), payment instruments (`CASH`, `PAYLATER`, `CREDIT_CARD`), tenors (`3x`, `6 bulan`, `12期`), THR/bonus queries, period variance queries, and custom formula expressions.

### Tier 2 — Encrypted BYOK LLM Tool-Calling (`marquee-llm.service.ts`)
Configured per user at `/preferences?sub=ai` (or via environment variables `DEEPSEEK_API_KEY`, `OPENCODE_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`):
- **DeepSeek (`DEEPSEEK`):** OpenAI-compatible function calling via `https://api.deepseek.com/v1/chat/completions` supporting both `deepseek-chat` (DeepSeek-V3) and `deepseek-reasoner` (DeepSeek-R1).
- **OpenCode (`OPENCODE`):** OpenCode Zen / OpenAI-compatible function calling via configurable `opencodeBaseUrl` (default `https://api.opencode.ai/v1`) and `opencodeModel` (default `opencode-chat`).
- **Google Gemini (`GEMINI`):** Uses `@google/genai` (`new GoogleGenAI({ apiKey })`) and `ai.interactions.create({ model: 'gemini-3.8-flash', input, tools })`.
- **Groq (`GROQ`):** Uses `llama-3.3-70b-versatile` tool calling via `https://api.groq.com/openai/v1/chat/completions`.
- **Auto Cascade (`AUTO`):** Tries configured providers in order (`DEEPSEEK -> OPENCODE -> GEMINI -> GROQ -> TIER1_ONLY`).
- **AES-256-GCM Encryption at Rest (`apps/api/src/common/crypto.util.ts`):** All four provider keys are encrypted with AES-256-GCM before storage in `GlobalConfig.financialPolicyJson.marqueeAi`. Plaintext keys are never returned by `GET /api/marquee/config`.

### Tier 3 — Headless Quick-Capture Webhook (`POST /api/marquee/webhook`)
- Public endpoint authenticated strictly by the `X-Marquee-Token` HTTP header (verified with `crypto.timingSafeEqual` against `webhookTokenHash`). Spoofed `x-user-id` headers are ignored; missing or invalid tokens return `401 Unauthorized`.

---

## 3. The 8 Canonical Deterministic Financial Tools

| Canonical Tool Name | Legacy Alias(es) | Authoritative Service / Selector | Behavior |
| :--- | :--- | :--- | :--- |
| `get_paycycle_pulse` | `get_financial_pulse` | `SnapshotsSelectors.getDefaultActivePeriod`, `FinanceSelectors.getPacing` | Read-only 3-state pacing (`PRE_PAYDAY` / `ACTIVE` / `COMPLETED`), safe-to-spend today, funded living pool, and shortfall. |
| `simulate_purchase_cutoff` | `evaluate_affordability` | `FinanceSelectors.simulateCutoffForUser` | Simulates SPayLater (15th cutoff -> 25th due) or Card (20th cutoff -> 11th due) landing cycle and post-purchase DSR verdict. |
| `optimize_payday_thr_split` | — | `SnapshotsSelectors.getOrCreateDraftSnapshot` | Recommends deterministic split of a THR/holiday bonus across shortfall cover, P1 Core Vault, debt prepayment, and holiday living buffer. |
| `analyze_debt_burndown` | `get_debt_burndown`, `simulate_debt_payoff` | `FinanceSelectors.getContractsBurndown`, `FinanceSelectors.getIntelligenceBundle` | Summarizes active installment plans, remaining principal, Snowball/Avalanche prepayment impact, and `JAN '27` / `FEB '27` / `SEP '27` milestones. |
| `evaluate_custom_formula` | — | `SnapshotsSelectors.getOrCreateDraftSnapshot`, `FinanceSelectors.getPacing` | Evaluates custom arithmetic formulas over live cycle variables (`net_income`, `total_debt`, `living_pool`, `shortfall`, `p1_savings`, `p2_buffer`, `daily_rate`). |
| `prepare_quick_transaction` | `log_quick_expense` | `FinanceSelectors.simulateCutoffForUser`, `FinanceService.createTransaction`, `CreditService.createLineItemSchedule` | Stages a confirmation card (`pendingAction`) when `confirm=false`; commits cash transaction or cutoff-routed installment schedule when `confirm=true`. |
| `prepare_wallet_checkin` | `wallet_checkin_guard` | `FinanceService.evaluateAndPersistWalletGuard` | Computes free spendable wallet cash after holding unpaid cycle bills. |
| `explain_period_variance` | `get_upcoming_bills`, `get_savings_and_goals` | `SnapshotsSelectors.getOrCreateDraftSnapshot`, `CreditSelectors.getLiabilityMatrix`, `SavingsSelectors.getOverview` | Compares cycle-over-cycle deltas (e.g. `11/2026` vs `12/2026` Natal THR) across income, debt, living pool, shortfall, and P1 Vault. |

---

## 4. UI Surface & Floating Bottom-Right Launcher

- **Floating Launcher ([`MarqueeFloatingLauncher.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/marquee/MarqueeFloatingLauncher.tsx)):** Mounted globally at `fixed bottom-5 right-5 z-40 print-hidden` (`data-testid="marquee-floating-launcher"`), rendering the bespoke `<MarqueeMark />` vector SVG emblem and `Alt+M` badge with zero pulsing or bouncing animations.
- **Top-Layer Drawer ([`MarqueeCoPilotDrawer.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/marquee/MarqueeCoPilotDrawer.tsx)):** Native `<dialog class="marquee-drawer">` opened via `showModal()`, passing active route and sub-tab context (`pathname`, `searchParams.get("sub")`) on every query.
- **Full Workstation ([`MarqueeWorkspaceClient.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/marquee/MarqueeWorkspaceClient.tsx)):** Asymmetric 12-column (`8 / 4`) layout pairing the conversation canvas with a live Hydrated Domain Context rail.

# Marquee AI Co-Pilot & Quick-Capture Specification

Marquee is Sunday Funday ERP's 3-tier deterministic, context-hydrated financial co-pilot and quick-capture engine (`apps/api/src/marquee/`, `apps/web/components/marquee/`).

---

## 1. Guiding Principle: Full Ledger Hydration + Zero Hallucinated Math

Large language models must **never** invent Rupiah balances, Debt Service Ratios (DSR), cutoff dates, or waterfall allocations in free text. On every turn:
1. **`MarqueeContextHydrator` (`apps/api/src/marquee/marquee-context.service.ts`)** hydrates the authenticated user's live, `userId`-isolated state:
   - Active paycycle & temporal state (`PRE_PAYDAY` / `ACTIVE` / `COMPLETED`, days until payday, two-stage payday law: `25th attendance & payslip cutoff + H+2 working days transfer`),
   - Multi-cycle snapshots (`10/2026..03/2027` income, total debt, funded living pool, uncovered shortfall, P1 Core Vault, P2 buffer under the Consumption & Bill-Maturity Month convention where period `M` covers `Payday(M-1)` through `Day before Payday(M)` and pays Month `M` bills),
   - Due-day calendar (`[11, 17, 23, 24, 25]` with H-1 business-day weekend shifts on the 11th when on Sat/Sun; dynamic SPayLater cutoff `daysInMonth - 15 -> 25th`, Permata Credit Card cutoff `25th -> 11th H-1`),
   - Installment payoff milestones (`JAN '27` SPinjam #1 retires, `FEB '27` 11.11 3x plans and SPinjam #2/#3 finish, `MAR '27` SPinjam reaches `Rp 0`, `SEP '27` final 12x card & 48/48 Mandiri KSM installments mature),
   - Proactive reminders (`proactiveReminders`: upcoming SPayLater dynamic `15th`/`16th` cutoff, Permata CC `25th` cutoff, next payday transition, and daily safe-to-spend allowance),
   - Active UI route & sub-tab context (`activeRoute`, `activeSubTab`, `locale`).
2. User intent is resolved via **Tier 2** live conversational + two-turn tool-calling LLM (`deepseek-flash` / DeepSeek V4.1 Flash primary via `api.deepseek.com` with `sk-...` auto-bridge, **OpenCode Zen** `deepseek-v4.1-flash-free`, **Google Gemini** `gemini-3.8-flash`, or **Groq** `llama-3.3-70b-versatile`) with automatic graceful **Tier 1** (`<5ms` trilingual NLU) offline fallback when no LLM key is configured or unreachable. Casual conversational prompts (`tool: null`, e.g., `"hi"`) respond naturally without forcing heavy ledger dumps.
3. Reasoning blocks (`<think>...</think>`) and emojis emitted by reasoning models are automatically stripped from the visible answer (`stripReasoningBlocks`), while developer trace tags (`TIER1_NLU`, raw snake_case tool names) are scrubbed cleanly from consumer chat chrome (`agentSteps` and `sanitizeReasoningForUi`). Responses render clean GitHub-style Markdown (headings, lists, bold figures, inline code, tables).
4. **Bounded Multi-Step Tool Loop (`ReAct`, max 4 hops):** Tier 2 OpenAI-compatible providers (`DEEPSEEK`, `OPENCODE`, `GROQ`) can chain up to 4 read-only tool calls in one turn (e.g. `get_paycycle_pulse` -> `simulate_purchase_cutoff` -> `prepare_quick_transaction`) and automatically stop once a 1-click confirmation card (`pendingAction`) or explicit domain refusal (`refuse_out_of_scope`) is reached.
5. **User Financial Memory (`manage_user_memory`), Scoped History Archive Search (`search_financial_history`), & Domain Guardrail (`refuse_out_of_scope`):**
   - Remembered merchant rules (`GlobalConfig.financialPolicyJson.marqueeMemory`) inject into `systemPrompt` and auto-select default payment methods (`PAYLATER` / `CREDIT_CARD` / `CASH`) when prompts omit an explicit method.
   - `search_financial_history` performs synonym-expanded retrieval across the authenticated user's own `Transaction`, `CreditCardTransaction`, and `LiabilityLineItem` archive with exact Rupiah sums.
   - Non-financial, terminal/shell, download, and raw `ExecuteSQL` prompts are rejected cleanly by `refuse_out_of_scope`.

### Tier 4 — Authenticated Business MCP Server (`POST /api/marquee/mcp` + `scripts/sundayfunday-mcp.ts`)
- Streamable HTTP JSON-RPC 2.0 endpoint authenticated strictly via `X-Marquee-Token` or verified JWT (`initialize`, `tools/list`, `tools/call`) plus optional local stdio bridge (`npx tsx scripts/sundayfunday-mcp.ts`).
- Exposes only the **15 curated ERP business functions** (`confirm` defaults to safe preview `false` on mutating calls); unknown/unpermitted tools like `execute_sql` or `run_shell` return `isError: true` with domain restriction guidance.

---

## 2. Three-Tier Architecture & Provider Matrix

### Tier 1 — Zero-Latency Trilingual Deterministic NLU (`marquee-nlu.ts`)
- Works out of the box with **zero external API keys** and **zero network latency**.
- Understands English (`EN`), Bahasa Indonesia (`ID`), and Simplified Chinese (`ZH`).
- Parses Indonesian Rupiah shorthands (`45k`, `85rb`, `85 ribu`, `1.5jt`, `1,5 juta`, `Rp 75.000`, `5万`), payment instruments (`CASH`, `PAYLATER`, `CREDIT_CARD`), tenors (`3x`, `6 bulan`, `12期`), THR/bonus queries, period variance queries, and custom formula expressions.

### Tier 2 — Encrypted BYOK LLM Tool-Calling (`marquee-llm.service.ts`)
Configured per user at `/preferences?sub=ai` (or via environment variables `DEEPSEEK_API_KEY`, `OPENCODE_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`):
- **DeepSeek (`DEEPSEEK`):** OpenAI-compatible function calling via `https://api.deepseek.com/v1/chat/completions` supporting **`deepseek-flash`** (DeepSeek V4.1 Flash, default), `deepseek-chat` (DeepSeek-V3), and `deepseek-reasoner` (DeepSeek-R1), with two-turn `synthesizeToolResult` natural synthesis and conversational `tool: null` handling.
- **OpenCode (`OPENCODE`):** OpenCode Zen / OpenAI-compatible function calling via configurable `opencodeBaseUrl` (default `https://opencode.ai/zen/v1`) and `opencodeModel` (default `deepseek-v4.1-flash-free`), auto-bridging `sk-...` DeepSeek keys cleanly.
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
| `simulate_purchase_cutoff` | `evaluate_affordability` | `FinanceSelectors.simulateCutoffForUser` | Simulates SPayLater (dynamic `daysInMonth - 15` cutoff -> 25th due) or Permata Card (25th cutoff -> 11th H-1 business-day due) landing cycle and post-purchase DSR verdict for an optional `purchaseDate`. |
| `optimize_payday_thr_split` | — | `SnapshotsSelectors.getOrCreateDraftSnapshot` | Recommends deterministic split of a THR/holiday bonus across shortfall cover, P1 Core Vault, debt prepayment, and holiday living buffer. |
| `analyze_debt_burndown` | `get_debt_burndown`, `simulate_debt_payoff` | `FinanceSelectors.getContractsBurndown`, `FinanceSelectors.getIntelligenceBundle` | Summarizes active installment plans, remaining principal, Snowball/Avalanche prepayment impact, and `JAN '27` / `FEB '27` / `SEP '27` milestones. |
| `evaluate_custom_formula` | — | `SnapshotsSelectors.getOrCreateDraftSnapshot`, `FinanceSelectors.getPacing`, `evaluateFormulaDslTs` | Evaluates custom arithmetic formulas using the safe AST parser (`formula-dsl.ts`, zero dynamic eval) over live cycle variables (`net_income`, `total_debt`, `living_pool`, `shortfall`, `p1_savings`, `p2_buffer`, `daily_rate`). |
| `prepare_quick_transaction` | `log_quick_expense` | `FinanceSelectors.simulateCutoffForUser`, `FinanceService.createTransaction`, `CreditService.createLineItemSchedule` | Stages a confirmation card (`pendingAction`) when `confirm=false`; commits cash transaction or cutoff-routed installment schedule when `confirm=true`. |
| `prepare_wallet_checkin` | `wallet_checkin_guard` | `FinanceService.evaluateAndPersistWalletGuard` | Computes free spendable wallet cash after holding unpaid cycle bills. |
| `explain_period_variance` | `get_upcoming_bills`, `get_savings_and_goals` | `SnapshotsSelectors.getOrCreateDraftSnapshot`, `CreditSelectors.getLiabilityMatrix`, `SavingsSelectors.getOverview` | Compares cycle-over-cycle deltas (e.g. `11/2026` vs `12/2026` Natal THR) across income, debt, living pool, shortfall, and P1 Vault. |

---

## 4. UI Surface & Icon-Only Floating Bottom-Right Launcher

- **Icon-Only Floating Launcher ([`MarqueeFloatingLauncher.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/marquee/MarqueeFloatingLauncher.tsx)):** Mounted globally at `fixed bottom-5 right-5 z-40 print-hidden` (`data-testid="marquee-floating-launcher"`), rendering a compact `44x44px` (`w-11 h-11 rounded-full`) button containing only the bespoke `<MarqueeMark />` vector SVG emblem and a subtle status indicator dot, with native hover tooltip `title="Marquee Financial Co-Pilot (Alt+M)"`. Redundant Sidebar and Header Marquee launcher buttons are removed; the Sidebar `AUDIT & DECISION` slot now opens **Spending & Trend Review** (`/analytics`).
- **Top-Layer Drawer ([`MarqueeCoPilotDrawer.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/marquee/MarqueeCoPilotDrawer.tsx)):** Native `<dialog class="marquee-drawer">` opened via `showModal()`, rendering a **Proactive Paycycle Digest** strip (`proactiveReminders`) at the top and passing active route and sub-tab context (`pathname`, `searchParams.get("sub")`) on every query.
- **Full Workstation ([`MarqueeWorkspaceClient.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/marquee/MarqueeWorkspaceClient.tsx)):** Asymmetric 12-column (`8 / 4`) layout pairing the conversation canvas with a live Hydrated Domain Context rail.

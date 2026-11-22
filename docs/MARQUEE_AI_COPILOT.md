# Marquee AI Co-Pilot & Quick-Capture Specification

Marquee is Sunday Funday ERP's 3-tier deterministic financial assistant and quick-capture engine (`apps/api/src/marquee/`, `apps/web/components/marquee/`).

---

## 1. Guiding Principle: Zero Hallucinated Math

Large language models must **never** compute Rupiah balances, Debt Service Ratios (DSR), cutoff dates, or waterfall allocations in free text. In Marquee:
1. User intent is resolved either by **Tier 1** (deterministic in-process trilingual NLU in `<5ms`) or **Tier 2** (optional BYOK function-calling via `@google/genai` `gemini-3.8-flash` or Groq `llama-3.3-70b-versatile`).
2. The resolved intent invokes one of **8 deterministic tools** in `MarqueeToolsService`, which calls the authoritative NestJS services/selectors and Go engine.
3. Structured `cards[]` and Rupiah figures come 100% from the deterministic tool output.

---

## 2. Three-Tier Architecture

### Tier 1 — Zero-Latency Trilingual Deterministic NLU (`marquee-nlu.ts`)
- Works out of the box with **zero external API keys** and **zero network latency**.
- Understands English (`EN`), Bahasa Indonesia (`ID`), and Simplified Chinese (`ZH`).
- Parses Indonesian Rupiah shorthands (`45k`, `85rb`, `85 ribu`, `1.5jt`, `1,5 juta`, `Rp 75.000`, `5万`), payment instruments (`CASH`, `PAYLATER`, `CREDIT_CARD`), and tenors (`3x`, `6 bulan`, `12期`).

### Tier 2 — Encrypted BYOK LLM Tool-Calling (`marquee-llm.service.ts`)
- Optional per-user API keys configured at `/preferences?sub=ai`.
- **Google Gemini:** Uses `@google/genai` (`new GoogleGenAI({ apiKey })`) and `ai.interactions.create({ model: 'gemini-3.8-flash', input, tools })`.
- **Groq:** Uses `llama-3.3-70b-versatile` tool calling via `https://api.groq.com/openai/v1/chat/completions`.
- **Encryption at Rest (`apps/api/src/common/crypto.util.ts`):** Keys are encrypted with **AES-256-GCM** (`v1:<12-byte-iv-hex>:<16-byte-authTag-hex>:<ciphertext-hex>`) before storage in `GlobalConfig.financialPolicyJson.marqueeAi`. Plaintext keys are never returned by `GET /api/marquee/config` (only masked 4-character previews `****1234` and boolean presence flags).
- Automatically falls back to Tier 1 NLU if a key is unconfigured, rate-limited, or unreachable.

### Tier 3 — Headless Quick-Capture Webhook (`POST /api/marquee/webhook`)
- Public endpoint authenticated exclusively by the `X-Marquee-Token` HTTP header.
- Each user can generate or rotate a 24-byte random token (`mrq_<48-hex>`) in `/preferences?sub=ai`.
- Only the **SHA-256 hash** (`webhookTokenHash`) is persisted in `GlobalConfig.financialPolicyJson.marqueeAi`.
- Incoming `X-Marquee-Token` headers are verified using `crypto.timingSafeEqual` (`verifySecretToken`). Spoofed `x-user-id` headers are ignored; missing or invalid tokens return `401 Unauthorized`.

---

## 3. The 8 Deterministic Financial Tools

| Tool Name | Authoritative Service / Selector | Mutation Behavior |
| :--- | :--- | :--- |
| `get_financial_pulse` | `SnapshotsSelectors.getDefaultActivePeriod`, `FinanceSelectors.getPacing` | Read-only (3-state pacing, safe-to-spend, living cash, shortfall). |
| `log_quick_expense` | `FinanceSelectors.simulateCutoffForUser`, `FinanceService.createTransaction`, `CreditService.createLineItemSchedule` | Returns confirmation preview (`pendingAction`) when `confirm=false`; writes transaction or cutoff-routed line item when `confirm=true`. |
| `evaluate_affordability` | `FinanceSelectors.simulateCutoffForUser` | Read-only cutoff routing & DSR verdict (`SAFE` / `CAUTION` / `RISKY`). |
| `get_upcoming_bills` | `CreditSelectors.getLiabilityMatrix` | Read-only period liability breakdown (PayLater 25th, CC 11th, Personal Debt). |
| `wallet_checkin_guard` | `FinanceService.evaluateAndPersistWalletGuard` | Evaluates free spendable wallet cash after unpaid bill hold. |
| `get_debt_burndown` | `FinanceSelectors.getContractsBurndown` | Read-only multi-month contract burndown & debt freedom horizon. |
| `get_savings_and_goals` | `SavingsSelectors.getOverview`, `SavingsSelectors.getGoals` | Read-only P1 Core Savings (RDPU + liquid) & goal progress. |
| `simulate_debt_payoff` | `FinanceSelectors.getIntelligenceBundle` | Read-only Snowball vs Avalanche lump-sum prepayment simulation. |

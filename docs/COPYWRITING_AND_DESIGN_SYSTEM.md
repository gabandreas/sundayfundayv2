# Copywriting, Terminology & Anti-AI-Slop Visual Design System

This specification governs every piece of UI copy, Marquee AI Co-Pilot prose, trilingual (`EN` / `ID` / `ZH`) translation, and layout component in **Sunday Funday ERP**. It is enforced automatically by [`copy-and-design-audit.spec.ts`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/api/src/calculator/copy-and-design-audit.spec.ts).

---

## 1. The 6 Human Writing Laws

Every headline, empty state, helper label, and Marquee AI response must follow six rules:

1. **Concrete Nouns & Active Verbs:** State who does what to which Rupiah balance. Replace vague abstractions (*"liquidity telemetry orchestration"*) with direct action (*"Your Nov 27 paycheck funds Rp 1.416.659 for daily living"*).
2. **Everyday Human Words Over Stiff Jargon:** Use plain banking and household terms rather than academic or sci-fi metaphors:
   - Say **"Savings & Emergency Fund"** (`EN`), **"Tabungan & Dana Darurat"** (`ID`), **"储蓄与应急基金"** (`ZH`) — never *"Savings & Reservoirs"* or *"Savings & Vaults"*.
   - Say **"Temporary Savings Advance"** / **"Savings Deposit"** — never *"Forward-Borrow"*, *"Vault Transfer"*, or *"P1 / P2 / P3"*.
   - Say **"Core Savings Reserve"** & **"Flexible Surplus"** (or user-configured tier names from Preferences) — never raw *"P1"*, *"P2"*, *"Priority 1"*, *"DEBT_FIRST_WATERFALL"*, *"FIXED_ESSENTIAL"*, or *"EMERGENCY_FUND"*.
   - Say **"Bill Schedule"** — never *"Liability Matrix"* or *"Amortization"*.
   - Say **"Manual Bill Total (Override)"** — never *"Lump-Sum Override"*.
   - Say **"Active Installment Plans"** (`EN`), **"Daftar Cicilan Aktif"** (`ID`), **"当前分期计划"** (`ZH`) — never *"Amortization & Payoff Progress Lanes"*.
   - Say **"Periodic Bill Set-Asides"** — never *"Sinking Fund Amortization"*.
   - Say **"Installment Progress"** — never *"Contract Amortization"*.
   - Say **"Payroll Setup"** — never *"Income Archetype"*.
3. **Varied Rhythm & Sentence Length:** Mix crisp metric declarations (`"Shortfall: Rp 83.341."`) with one-sentence explanations of cause and effect.
4. **Candid Financial Advisor Tone (Zero Sycophancy):** Never praise the user for asking a question (*"Great question!"*, *"You're doing amazing!"*) or soften hard math with marketing fluff (*"seamlessly"*, *"effortlessly"*, *"supercharge"*).
5. **Zero Robotic Transitions:** Banned opening and connecting phrases across all languages:
   - `EN`: *"Furthermore"*, *"Moreover"*, *"In conclusion"*, *"It is worth noting"*, *"Delve"*, *"Tapestry"*, *"Testament"*.
   - `ID`: *"Oleh karena itu"*, *"Sebagai kesimpulan"*, *"Perlu dicatat bahwa"*, *"Selain itu dapat disimpulkan"*.
6. **Trilingual (`EN` / `ID` / `ZH`) Parity:** Indonesian copy reads like natural Jakarta financial prose (*"Cicilan aktif"*, *"Tabungan & Dana Darurat"*, *"Dana hidup harian"*), and Chinese copy uses natural mainland/Singapore financial terms (*"储蓄与应急基金"*, *"当前分期计划"*, *"今日安全支出"*).

---

## 2. Anti-AI-Slop Visual Architecture

1. **Zero Generic AI Cliché Icons:** `Sparkles`, `Wand2`, and `Bot` from `lucide-react` are strictly banned across `apps/web`. Marquee uses the bespoke geometric vector monogram [`MarqueeMark.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/primitives/MarqueeMark.tsx).
2. **Zero Decorative Emojis:** No emojis in headings, buttons, badges, empty states, or Marquee replies.
3. **Zero Glassmorphism (`backdrop-blur-*`):** Overlays and modals use crisp, high-contrast solid charcoal/slate surfaces (`bg-black/75`, `bg-surface`, `border-border`) with zero `backdrop-blur` classes.
4. **Unified Highlight & Callout Tokens (`globals.css`):** Selected cards, active drawer items, and alerts use semantic dark-slate utility tokens (`.erp-surface-selected`, `.erp-callout-caution`, `.erp-callout-urgency`, `.erp-callout-positive`) instead of loud yellow/white wireframe borders.
5. **Zero Dev-Trace & Model-Name Leakage in Consumer AI Chat:** Marquee chat prose and settings chrome strip `<think>` blocks, emojis, model version IDs (`Gemini 3.8`, `DeepSeek-V4.1`, `Llama 3.3`), and internal `TIER1_NLU` / `Tier 2` / `Provider:` debug tags.
6. **Zero CAPSLOCK Shouted UI Labels:** Tailwind `uppercase` utility classes and shouted multi-word ALL-CAPS strings are banned across UI components and translations (genuine acronyms such as `ERP`, `IDR`, `THR`, `SMTP`, `IP`, `DSR`, `CSV`, `SQL`, `MCP` excluded). Use human Title/Sentence case (`Safe-to-Spend Today`, `27 Nov`).
7. **Compact Single-Row Header, Monogram Popover Menu & Unified Toast (`AppHeader.tsx` + `ToastViewport.tsx`):**
   - Header height stays `48px` (`h-12`) with one single global `<PrivacyEyeButton />` toggle (never repeated inside cards) and an icon-only monogram trigger (`AccountHeaderBadge.tsx`) opening a native `popover="auto"` + `focusgroup="menu nomemory"` menu with keyboard arrow/Home/End/Escape navigation.
   - Notifications route through `ToastProvider` + `ToastViewport` (`popover="manual"`, `role="region"`, `aria-label="Notifications"`, `ariaNotify` + `aria-live`, hover/focus pause, `transition-behavior: allow-discrete`).
8. **Flattened Card Hierarchy (Hairline-Divided Strips):** Never nest bordered mini-cards inside sub-cards inside parent cards (`card-in-card-in-card`). Group secondary metrics inside a card using hairline dividers (`divide-x divide-border-subtle border-y border-border-subtle py-2.5`).
9. **Intentional Asymmetric Grid Proportions:** Avoid reflexive 3-equal-column (`grid-cols-3`) rows for unequal domain concepts. Use 12-column asymmetric proportions (`5 / 4 / 3` on `OverviewExecutiveRibbon`, `8 / 4` with `min-w-0` and `xl:sticky` on `MarqueeWorkspaceClient`).
10. **Typographic Discipline:** Reserve the display serif face (`font-serif` / `font-display`) strictly for centerpiece numbers (Safe-to-Spend Today, Net Position, Discipline Score). All secondary figures, ledger rows, and matrices use tabular monospace (`font-mono tabular-nums`).

---

## 3. Temporal & Chart Axis Law (`PRE_PAYDAY` / `ACTIVE` / `COMPLETED`)

- When a paycycle is in `PRE_PAYDAY` state (`Day 0 of N`, before `payrollPayoutDate`), charts and ribbons must **never** display generic `DAY 1` / `DAY 32` axis labels or misleading `0.00x` / `0.0% elapsed` burn warnings.
- In `PRE_PAYDAY` state, [`MiniTrendChart.tsx`](file:///d:/Projects/Project%20Hijack/mondaymondayv2/apps/web/components/primitives/MiniTrendChart.tsx) formats `cycleStartDate` and `cycleEndDate` directly on the left and right horizontal axis bounds (for `12/2026` on Nov 22, 2026: **`27 Nov`** on the left and **`27 Dec`** on the right, with center status **`Starts 27 Nov`**; while `11/2026` is `ACTIVE` at Day 26 of 30 with **`28 Oct (Day 1)`** on the left and **`26 Nov (Day 30)`** on the right).

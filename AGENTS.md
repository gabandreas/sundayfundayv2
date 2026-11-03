# AGENTS.md — Working Contract

Read this before writing or modifying any code. This is the source of truth for this repo.

---

## Scope & Intent

This is a personal finance ERP for a single user, desktop web only — no mobile or responsive layout is required, do not build one.

Monorepo, two services:
- `apps/web` — Next.js (App Router), the only UI surface.
- `apps/api` — NestJS, owns all business logic, calculations, and the Prisma/PostgreSQL layer.

This is a rebuild (V2) of an existing working app. The financial calculation logic (payroll, waterfall allocation, daily pacing, debt ratio, audit scoring) is already correct in spirit and must be preserved 1:1 in outcome. What's being rebuilt is everything else: the flow, the information architecture, the UX, and the visual design — those should be overhauled aggressively. Do not touch a formula unless explicitly told to; if you think a formula is wrong, flag it, don't silently change it.

Note: The waterfall priority structure was explicitly revised from the original V1-ported 4-priority order to a 2-priority order (Daily Operational reclassified as an upfront essential rather than a waterfall priority) on September 17, 2026, per explicit user decision after review. This is a deliberate, confirmed exception to the 'preserve V1 calculation logic as-is' principle stated elsewhere in this document — it does not indicate the preservation principle was violated.

Note: The consumption cycle architecture was explicitly revised from a fixed calendar-month window (1st to last day of month M+1) to an authentic payday-to-payday variable window (period M's actual `payrollPayoutDate` to the day before period M+1's `payrollPayoutDate`) on September 19, 2026, per explicit user decision. This change modifies only live daily pacing time boundaries and leaves all stored waterfall and payroll dollar calculations 100% byte-identical.

Before writing any code, check:
1. Does this belong in `services` (business logic/mutation) or the read-query layer? Never mix the two.
2. Is there already a single authoritative place this calculation lives? If yes, call it — don't reimplement it.
3. Does this change introduce a side effect inside a GET/read path? If yes, stop — reads must never mutate state.

---

## Zero AI-Slop Policy

Enforced on every file touched: code, UI copy, comments, commit messages, docs. This section is checked on every UI change, not just at the start of the project.

## One Signal Per State

Before adding any visual indicator (badge, label, border, background tint, icon), check whether something already on the same view communicates that same fact. If yes, don't stack a second one — strengthen or replace the existing signal instead.

This applies to:
- "Current" or "active" states (don't combine a badge chip + bold text + background tint + border all at once — pick one).
- Editability affordances (a dashed border + ghost placeholder is enough; don't also add a permanent text label).
- Severity/intensity states (color alone is usually sufficient; reserve a text badge for cases where color truly cannot carry the meaning, e.g. colorblind-unsafe distinctions — and even then, prefer a tooltip over a permanently visible chip).

Bracket-style status text (`[CURRENT]`, `[HEAVY]`, `[ELEVATED]`) reads as terminal/log output, not product copy — avoid it regardless of how many signals are otherwise in play.

The test before shipping any UI state: could I delete one of these indicators without losing the information? If yes, delete it.

### Language & tone
1. **No marketing/sugar-coated language.** Banned words/patterns: "seamless", "powerful", "effortlessly", "unlock", "supercharge", "elevate", "blazing-fast", "smart", "intelligent", and cutesy feature naming (e.g. don't call a savings balance a "Vault" unless that's genuinely the plainest word for it — prefer the boring, exact term).
   - Wrong: "Your Safe-to-Spend Vault, effortlessly tracked."
   - Right: "Available today: Rp 85,000."
2. **Write like a real engineer shipped it, not like a demo.** No inflated empty states ("You have no transactions yet! Let's add your first one 🎉"), no over-explained tooltips, no "Are you sure?" copy that reads like a UX pattern library sample.
3. **Naming is literal, not thematic.** Don't force a metaphor onto domain concepts. Call things what they are: `dailyOperationalBudget`, not `livingPocket`, unless the plain term is genuinely awkward.
4. **No unsolicited scope creep.** Implement what's asked. Don't add a feature, a settings toggle, or a "nice to have" UI flourish that wasn't requested.

### Visual anti-patterns (the specific tells that make UI read as AI-generated)
5. **No emoji anywhere** — not in code, not in commit messages, not in UI copy, not in empty states.
6. **No icon-in-a-soft-color-circle badges.** A Lucide/Heroicon icon centered inside a pastel circular background is the single most recognizable "AI/template-generated UI" tell. Use icons directly, unadorned, or give them a treatment specific to this app's visual system — never the generic badge wrapper.
7. **No blanket `rounded-2xl`/`rounded-3xl` on every surface.** Radius is chosen per element, not applied uniformly because it's the default. Small elements (badges, buttons, inputs) should generally be sharper than large surfaces (cards, panels).
8. **No gradient text, no gradient borders, no glassmorphism/blur cards.**
9. **No perfectly symmetric 3-column grids used reflexively for every section.** If content doesn't naturally divide evenly, don't force it into one — asymmetric layouts are fine and often better.
10. **No unmodified default type scale.** At least the primary numeric displays (safe-to-spend, total balance, key card metrics) must use a deliberately tuned size/weight/tracking — not whatever `text-lg`/`text-xl` defaults ship with.
11. **Spacing should read as intentional, not mechanically uniform.** Perfect, identical gutter spacing applied everywhere without variation is itself a tell — real design has purposeful rhythm, not a single repeated value stamped everywhere.

---

## Architecture & Layering

### Backend (`apps/api`, NestJS)
src/<domain>/
<domain>.controller.ts # HTTP transport only — validates DTO, calls a service, returns DTO
<domain>.service.ts # Business logic, mutations, transactions
<domain>.selectors.ts # Read-only queries — no writes, ever
dto/ # class-validator DTOs, one per input shape

- Controllers must not contain calculation logic or direct Prisma writes.
- All financial math (payroll, waterfall, pacing, debt ratio, audit scoring) lives in one designated calculation module (`src/calculator/`) — every other module calls into it, never reimplements it.
- Any operation that changes a persistent record as a side effect of a read (e.g. auto-decrementing a loan's remaining tenor) is forbidden. State transitions that "close" a period must be an explicit, named endpoint/action, never implicit.
- Route prefixes must be consistent across all controllers (`/api/<domain>`), no exceptions.

### Frontend (`apps/web`, Next.js App Router)
- Month/year navigation context lives in the URL (`?month=9&year=2026`), never in local component state alone.
- Server Components fetch data directly; client-side data fetching (`useEffect` + axios) is only for interactions that genuinely need it (quick-add forms, live pacing ticker). Don't default to client-fetch-everything like V1 did.
- No duplicate derived calculations on the frontend. If the backend already computed `totalIncome`, the frontend displays it — it does not add fields together again to "double check."

---

## Financial Calculation Integrity (Non-Negotiable)

Specific bug classes from V1 that must not reappear:

1. **No double-counting.** Any liability, income source, or deduction is summed from exactly one source of truth. If a `CreditContract` installment is materialized into a `Transaction`, the raw contract total is not added again separately.
2. **One formula per metric.** A derived metric (e.g. discipline score) is calculated in exactly one function, called from everywhere it's needed — never two formulas producing two numbers for the same label.
3. **Reads never mutate.** No GET request or Server Component data-fetch may change a database row as a side effect.

---

## Visual Direction

No single reference is cloned. The direction is a deliberate combination of three references, each contributing a different thing:

- **Structure & restraint, from Linear:** dark charcoal/slate base — never pure black, never default Tailwind zinc-on-black. Precise spacing and borders, minimal decoration, no unnecessary chrome. This governs the base layout discipline.
- **Boldness & seriousness, from Ramp:** high contrast, confident/heavy typography for key numbers, an assertive accent color used sparingly for urgency (deficit states, warnings) — not soft or consumer-app-cute. This governs how "serious ERP" the product feels versus a lightweight budgeting app.
- **One custom typographic signature, from Mercury:** at least one deliberate serif or otherwise distinctive display face used specifically for the app's centerpiece numbers (safe-to-spend today, total balance, discipline score) — mixed against a clean sans/mono for everything else (labels, tables, ledger rows). This is the one element that makes the product visually memorable and unmistakably not a generic dashboard template.

### Base
- Dark charcoal/slate base, not pure black, not zinc-on-black.
- Sidebar: icon + label, active item gets a soft pill highlight. No collapsing/expanding animations beyond a simple state toggle.

### Color logic
- Positive/negative deltas use green/red (standard financial-app language, not slop) — shifted off any single reference's exact hue: a calmer emerald-teal for positive, a rust/terracotta for negative rather than stop-sign red.
- One assertive accent (Ramp-inspired) reserved specifically for urgency: deficit states, locked/blocked actions, warnings. This accent is used sparingly — if it's everywhere, it stops meaning anything.
- Warning/caution state (pacing `CAUTION` / `BURNING_FAST`) gets its own muted amber — distinct from both the urgency accent and the deficit red.

### Card anatomy
- Big bold number (the metric) with a small muted label above it. Centerpiece numbers (safe-to-spend, total balance, discipline score) use the custom display typeface described above; secondary numbers use the standard sans/mono.
- Small delta badge below the number: direction arrow + percentage + comparison period.
- Cards that show a trend get a minimal bar or line chart beneath — no gridlines, a single dashed marker for "today"/"now" where a time reference matters (maps directly onto the Daily Pacing card).

### Typography
- Numbers (currency, dates, percentages) get tabular/monospace figures wherever alignment matters — ledger rows, the 12-month liability matrix, standard card numbers.
- The Mercury-inspired display face is reserved for centerpiece numbers only — do not apply it broadly or it stops being a signature and becomes noise.
- No component-library defaults left unstyled (e.g. unmodified shadcn button/card out of the box is not acceptable as a final look).

### What's explicitly different from any single reference
- No mobile companion view — desktop web only.
- Card contents are designed from scratch per this app's actual domain concepts (waterfall priority breakdown, safe-to-spend pacing gauge with status, 12-month liability matrix, discipline/audit scorecard, wishlist debt-ratio simulator) — references inform layout rhythm and typographic treatment, not what data goes in which card.

---

## Checklist Before Committing

- [ ] No calculation duplicated across frontend/backend or across two backend functions.
- [ ] No read-path mutates a database record.
- [ ] No emoji, no banned marketing words, no unrequested UI flourish.
- [ ] No icon-in-a-soft-circle badge pattern, no blanket rounded-2xl/3xl, no gradient text/borders, no glassmorphism.
- [ ] At least the centerpiece numbers use the custom display typeface, not default type scale.
- [ ] Controller has no business logic; service has no HTTP concerns; selector has no writes.
- [ ] Month/year state reflected in the URL, not just local state.
- [ ] Route prefix consistent with the rest of the API.
- [ ] No mobile/responsive layout work introduced.
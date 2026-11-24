# Sunday Funday ERP Design & Craftsmanship Contract

## Art Direction Thesis: Editorial Private Banking Terminal

Sunday Funday ERP combines three deliberate structural references without cloning any template:
- **Linear** governs layout discipline: obsidian canvas (`#0c0e14`), quiet matte slate sidebar (`#11141c`), hairline separators (`#1f2430`), and restrained visual chrome.
- **Ramp** governs financial seriousness: confident numeric weight, high contrast text tokens (`#f3f4f6`), and muted terracotta/red urgency reserved strictly for real blocking states.
- **Mercury** contributes one typographic signature: `Newsreader` (`font-serif` / `--font-display`) reserved for 1–2 centerpiece balances per viewport, paired with `Geist` sans and `JetBrains Mono` tabular figures (`tabular-nums`) everywhere numbers align.

## Color & Surface Cap (Hard Gate)

- **Obsidian Neutral Scale:** `--color-canvas: #0c0e14`, `--color-surface-subtle: #11141c`, `--color-surface: #161922`, `--color-surface-elevated: #1d222e`, `--color-border-subtle: #1f2430`, `--color-border: #282e3d`.
- **Single Primary Accent:** Emerald-teal (`#10b78d`, `--color-accent` / `--color-delta-positive`).
- **Semantic Warnings Only:** Muted amber (`#e59b2c`, `--color-caution`) for fast-burn/budget caution; terracotta/urgency (`#e06c53` / `#ff3838`) exclusively for negative cash deltas, budget shortfalls, and period lock states.
- **Forbidden Visual Patterns:** Zero decorative gradients, zero `backdrop-blur-*` glassmorphism, zero purple/violet accents, zero icon-inside-pastel-circle badges, zero blanket `rounded-2xl`/`rounded-3xl`, zero emojis anywhere in code or UI.

## Liveliness Toolkit & Hierarchy Laws

1. **One Focal Point Per Viewport:** Lead with the cycle header and centerpiece balance; auxiliary alerts stay compact and never form multi-banner walls.
2. **Hairline Structure Over Box-in-Box Nesting:** Replace stacked bordered sub-cards inside a card with clean hairline dividers (`divide-y`, `divide-x`, `border-t border-border-subtle`).
3. **One Signal Per State:** Never stack a background tint + bold chip + status border + explanatory paragraph to announce the same state.
4. **No All-Caps Labels or Prose Em-Dashes:** Keep labels in crisp Title Case or natural sentence case (`text-xs` / `11px`, zero Tailwind `uppercase`). Never use ` — ` em-dashes inside UI prose or AI responses (en-dash `–` is for date ranges like `28 Oct – 26 Nov`; `—` alone is strictly for empty numeric cells).

## Motion Tokens & Frequency Gate

All surfaces and controls share one canonical timing vocabulary defined in `apps/web/app/globals.css`:
- `--ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1)`
- `--duration-press: 140ms`
- `--duration-surface: 180ms`

Rules:
- **Tactile Button Press:** Interactive `<button>` elements respond with `active:scale-[0.97]` (`scale: 0.97`) using `--ease-out-quint`.
- **Origin-Aware Disclosures:** Popovers and dropdowns scale cleanly (`0.96 -> 1`) from the edge anchored to their trigger (`transform-origin: top right` for right-aligned header menus) using `:is(:popover-open, .\:popover-open)` and `@starting-style`.
- **Frequency Gate (100+/Day Shortcut Rule):** High-frequency keyboard launchers (`Ctrl+K` Global Search) open instantaneously with **zero entry fade/zoom animation**.
- **Reduced Motion:** `@media (prefers-reduced-motion: reduce)` immediately disables transitions, transform scaling, and rail width animation.

## Accessibility & Keyboard Discipline

- **Never Strip Focus Without Replacement:** Global `:focus-visible` renders a high-contrast `2px solid var(--color-accent)` ring (`outline-offset: 2px`). Inputs with custom border rings pair `focus-visible:outline-none` with `focus-visible:ring-2` so keyboard focus is always obvious.
- **Landmarks & Skip Navigation:** `AppShell` provides an accessible skip-to-content link targeting `<main id="main-content" tabIndex={-1}>` and marks `<nav aria-label="Primary">` without repeating "navigation".
- **Active Page Indication:** Navigation items expose `aria-current="page"` paired with a 2px emerald accent indicator so state never depends on color alone.
- **Tabular & Unwrapped Currency:** All currency amounts carry `erp-tabular-currency` (`font-mono`, `tabular-nums`, `whitespace-nowrap`) so `Rp` prefixes never split from numeric digits at `1024px–1440px`.

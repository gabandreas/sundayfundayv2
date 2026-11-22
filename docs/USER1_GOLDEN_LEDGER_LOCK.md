# User #1 Golden Ledger Lock (`userId = 1` / Gabriel)

This document is the immutable baseline specification for **User #1 (`Gabriel` / `cheeseburger`, `userId = 1`, `gabandreas22@gmail.com`)** across Neon Cloud and Local PostgreSQL (`127.0.0.1:5433`).

> [!CAUTION]
> **Strict Production Data Protection Law:**
> 1. Never wipe, seed fake balances onto, or run destructive E2E mutations against `userId = 1`.
> 2. All destructive E2E, fuzz, and mutation tests must run exclusively against **Demo Sandbox (`userId = 2`)**.
> 3. Any automated test or script that inspects `userId = 1` must be 100% read-only and must assert the exact figures in this lock file via `npx tsx scripts/verify-zero-defect-erp.ts`.

---

## 1. Consumption & Bill-Maturity Month Convention (`Period M`)

Under the canonical **Consumption & Bill-Maturity Month = Period `M`** law:
- **Period `M` is funded by `Payday(M-1)`** and covers daily living consumption from **`Payday(M-1)` through `Day before Payday(M)`**, while paying all **Month `M` due dates** (`dueMonth === periodMonth`, `maturityMonth === periodMonth`):
  - **`10/2026` (`Oct 2026` — `LOCKED`):** Funded by **28 Sep 2026** payday (`28 Sep – 27 Oct 2026`), paid October 2026 bills (`Rp 4.082.655`).
  - **`11/2026` (`Nov 2026` — `DRAFT`, ACTIVE on 22 Nov 2026, Day 26 of 30, 5 days remaining):** Funded by **28 Oct 2026** payday (`28 Oct – 26 Nov 2026`, `30 days`), pays November 2026 bills (`Due Nov 8, 11, 25`: `PayLater Rp 3.264.116`, `CC Rp 1.060.900`, `Personal Rp 197.960`, `Total Debt = Rp 4.522.976`).
  - **`12/2026` (`Dec 2026` — `DRAFT`, `PRE_PAYDAY` on 22 Nov 2026, Day 0 of 31, starts in 5 days):** Funded by **27 Nov 2026** payday (`27 Nov – 27 Dec 2026`, `31 days`), pays December 2026 bills (`Due Dec 8, 11, 17, 23, 24, 25`: `PayLater Rp 2.783.115` including `Billiard, Beer & Indomaret Rp 170.000`, `CC Rp 734.256`, `Personal Rp 669.970`, `Total Debt = Rp 4.187.341`).
  - **`01/2027` (`Jan 2027` — `DRAFT`):** Funded by **28 Dec 2026** payday + pro-rated December Natal THR (`Rp 5.941.000 + Rp 3.899.917 = Rp 9.840.917`), runs `28 Dec 2026 – 26 Jan 2027` (`30 days`), pays January 2027 bills (`PayLater Rp 1.622.889`, `CC Rp 628.256`, `Personal + P1 Refund Rp 919.970`, `Total Debt = Rp 3.171.115`).
  - **`02/2027` (`Feb 2027` — `DRAFT`):** Funded by **27 Jan 2027** payday (`Rp 5.891.000`), runs `27 Jan – 24 Feb 2027`, pays February 2027 bills (`Total Debt = Rp 1.967.159`, final `3/3` slice of `11.11` PayLater & `Nov 08 / Nov 17` SPinjam).
  - **`03/2027` (`Mar 2027` — `DRAFT`):** Funded by **25 Feb 2027** payday (`Rp 5.891.000`), pays March 2027 bills (`Total Debt = Rp 835.996`, **SPinjam = `Rp 0`**, final `6/6` slice of Anthropic Claude CC).
  - **`04/2027` (`Apr 2027` — `DRAFT`):** Pays April 2027 bills (`Total Debt = Rp 697.726`, final `6/6` slice of New Balance 740 CC).
  - **`05/2027..08/2027` (`May..Aug 2027` — `DRAFT`):** Pays May..Aug 2027 bills (`Total Debt = Rp 293.044`, Nike Dunk CC + recurring Gemini AI Pro).

---

## 2. Active Cycle `11/2026` (`28 Oct – 26 Nov 2026`) Forensic Invariants

| Field / Metric | Exact Locked Value | Notes |
| --- | ---: | --- |
| `status` | `DRAFT` | Active cycle through `2026-11-26` |
| `payrollPayoutDate` | `2026-10-28` | Confirmed start of `11/2026` consumption window |
| `netSalaryIncome` | `Rp 5.891.000` | Base `5.300.000 - BPJS 159.000 + Laptop 250.000 + 20d * 25.000` |
| `finalTotalIncome` | `Rp 5.891.000` | Borrowed bridge loan (`Rp 900.000`) never inflates Net Income |
| `bridgeInflowAmount` | `Rp 900.000` | Tracked separately as bridge loan liquidity |
| `totalDeductions` | `Rp 4.522.976` | `PayLater 3.264.116 + CC 1.060.900 + Personal 197.960` |
| `transport` / `internet` | `Rp 200.000` / `Rp 200.000` | `Transport Quota` & `Nov 25 Bill`, both settled (`Rp 400.000` total) |
| `dailyOperational` | `Rp 1.720.316` | Revised living cash pool (`isManualOverride = true`) |
| `actualDailyOperational` | `Rp 1.720.316` | Funded living cash pool |
| `totalDailySpent` | `Rp 1.420.316` | `Rp 1.129.316` itemized (5 rows) + `Rp 291.000` balance checkpoint |
| `remainingBudget` | `Rp 300.000` | Exact Remaining Living Cash (`1.720.316 - 1.420.316`) |
| `actualSavings` (`lockedP1`) | `Rp 6.341` | Core Savings (P1) after Rp 250k Hoodie forward-borrow |
| `selfReward` (`lockedP2`) | `Rp 250.000` | Self-Reward (P2) |
| `deficitUncovered` | `Rp 0` | Balanced under manual override + bridge liquidity |

---

## 3. All-Period Snapshot Baseline Table (`07/2026` – `08/2027`)

| Period | Status | Manual Override | Final Total Income | Total Debt (`totalDeductions`) | Funded Living (`actualDailyOperational`) | Core Savings (`actualSavings`) | Self-Reward (`selfReward`) | Uncovered Deficit | Funding Payday |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `07/2026` | `LOCKED` | `false` | `Rp 5.841.000` | `Rp 0` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 1.456.000` | `Rp 0` | `2026-06-25` |
| `08/2026` | `LOCKED` | `false` | `Rp 5.891.000` | `Rp 2.524.000` | `Rp 2.850.000` | `Rp 0` | `Rp 67.000` | `Rp 0` | `2026-07-25` |
| `09/2026` | `LOCKED` | `false` | `Rp 5.881.400` | `Rp 2.985.684` | `Rp 2.045.000` | `Rp 500.000` | `Rp 716` | `Rp 0` | `2026-08-25` |
| `10/2026` | `LOCKED` | `false` | `Rp 5.791.000` | `Rp 4.082.655` | `Rp 991.000` | `Rp 328.345` | `Rp 0` | `Rp 0` | `2026-09-28` |
| `11/2026` | `DRAFT` | `true` | `Rp 5.891.000` | `Rp 4.522.976` | `Rp 1.720.316` | `Rp 6.341` | `Rp 250.000` | `Rp 0` | `2026-10-28` |
| `12/2026` | `DRAFT` | `false` | `Rp 5.904.000` | `Rp 4.187.341` | `Rp 1.416.659` | `Rp 0` | `Rp 0` | `Rp 83.341` | `2026-11-27` |
| `01/2027` | `DRAFT` | `false` | `Rp 9.840.917` | `Rp 3.171.115` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 2.284.802` | `Rp 0` | `2026-12-28` |
| `02/2027` | `DRAFT` | `false` | `Rp 5.891.000` | `Rp 1.967.159` | `Rp 2.850.000` | `Rp 538.841` | `Rp 0` | `Rp 0` | `2027-01-25` |
| `03/2027` | `DRAFT` | `false` | `Rp 5.891.000` | `Rp 835.996` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 670.004` | `Rp 0` | `2027-02-25` |
| `04/2027` | `DRAFT` | `false` | `Rp 5.766.000` | `Rp 697.726` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 683.274` | `Rp 0` | `2027-03-25` |
| `05/2027` | `DRAFT` | `false` | `Rp 5.916.000` | `Rp 293.044` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 1.237.956` | `Rp 0` | `2027-04-25` |
| `06/2027` | `DRAFT` | `false` | `Rp 5.891.000` | `Rp 293.044` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 1.212.956` | `Rp 0` | `2027-05-25` |
| `07/2027` | `DRAFT` | `false` | `Rp 5.841.000` | `Rp 293.044` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 1.162.956` | `Rp 0` | `2027-06-25` |
| `08/2027` | `DRAFT` | `false` | `Rp 5.941.000` | `Rp 293.044` | `Rp 2.850.000` | `Rp 1.000.000` | `Rp 1.262.956` | `Rp 0` | `2027-07-25` |

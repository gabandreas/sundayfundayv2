import React from "react";
import {
  AnalyticsKpis,
  CashflowPeriodEntry,
  CategoryDistributionEntry,
  MacroCategoryKey,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface CategoryDistributionPanelProps {
  categories: CategoryDistributionEntry[];
  series: CashflowPeriodEntry[];
  kpis: AnalyticsKpis;
  periodCount: number;
}

const CATEGORY_COLORS: Record<MacroCategoryKey, string> = {
  LIABILITIES_DEBT: "#D95B43",
  DAILY_OPERATIONAL: "#E59B2C",
  FIXED_ESSENTIALS: "#64748B",
  CORE_SAVINGS: "#2BB686",
  SELF_REWARD_SURPLUS: "#38BDF8",
  BUFFER_POCKET: "#A855F7",
};

function formatRp(amount: number): string {
  return formatRupiah(amount);
}

export function CategoryDistributionPanel({
  categories,
  series,
  kpis,
  periodCount,
}: CategoryDistributionPanelProps) {
  // Build SVG donut segments using stroke-dasharray on a circle of radius 62 (circumference ~ 389.557)
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  const nonZeroCategories = categories.filter((c) => c.totalAmount > 0);

  return (
    <div className="grid grid-cols-12 gap-5 items-start">
      {/* Left 4 Columns: 100%-Accounted Income Allocation & Category Breakdown */}
      <div className="col-span-4 rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="border-b border-border-subtle pb-3">
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans block">
            100% Income Conservation
          </span>
          <h2 className="text-base font-semibold font-sans text-text-primary mt-0.5">
            Aggregate Category Distribution
          </h2>
        </div>

        {/* Donut Ring + Aggregate Income Readout */}
        <div className="flex items-center gap-4 py-1">
          <div className="relative w-28 h-28 shrink-0">
            <svg
              viewBox="0 0 160 160"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label="Income allocation donut chart"
            >
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="18"
              />
              {kpis.totalIncomeAcrossPeriods > 0 &&
                nonZeroCategories.map((cat) => {
                  const fraction =
                    cat.totalAmount / kpis.totalIncomeAcrossPeriods;
                  const dashLength = Math.max(0, fraction * circumference);
                  const dashOffset = -cumulativeFraction * circumference;
                  cumulativeFraction += fraction;

                  return (
                    <circle
                      key={cat.key}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={CATEGORY_COLORS[cat.key]}
                      strokeWidth="18"
                      strokeDasharray={`${dashLength} ${circumference}`}
                      strokeDashoffset={dashOffset}
                    />
                  );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
              <span className="text-[9px] font-sans uppercase tracking-wider text-text-tertiary">
                {periodCount} {periodCount === 1 ? "Period" : "Periods"}
              </span>
              <span className="font-mono text-xs font-semibold text-text-primary tabular-nums mt-0.5">
                100.0%
              </span>
            </div>
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            <div>
              <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
                Cumulative Net Income
              </span>
              <span className="font-mono text-sm font-semibold text-text-primary tabular-nums">
                {formatRp(kpis.totalIncomeAcrossPeriods)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
                Cumulative Committed Outflow
              </span>
              <span className="font-mono text-xs font-medium text-text-secondary tabular-nums">
                {formatRp(kpis.totalOutflowAcrossPeriods)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
                Retained Savings + P2 Surplus
              </span>
              <span className="font-mono text-xs font-medium text-delta-positive tabular-nums">
                {formatRp(kpis.totalRetainedAndSurplusAcrossPeriods)}
              </span>
            </div>
          </div>
        </div>

        {/* Macro Categories & Sub-Breakdowns */}
        <div className="divide-y divide-border-subtle border-t border-border-subtle">
          {categories.map((cat) => {
            const activeSubItems = cat.subItems.filter((sub) => sub.amount > 0);
            return (
              <div key={cat.key} className="py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[cat.key] }}
                    />
                    <span className="text-xs font-medium font-sans text-text-primary truncate">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 font-mono tabular-nums shrink-0">
                    <span className="text-xs font-semibold text-text-primary">
                      {formatRp(cat.totalAmount)}
                    </span>
                    <span className="text-[11px] text-text-tertiary w-10 text-right">
                      {cat.shareOfIncomePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-tertiary font-mono pl-4.5">
                  <span>Avg: {formatRp(cat.monthlyAverage)}</span>
                  {cat.shareOfOutflowPercent > 0 && (
                    <span>{cat.shareOfOutflowPercent.toFixed(1)}% outflow</span>
                  )}
                </div>

                {/* Sub-item breakdown when category has >1 sub-item or meaningful decomposition */}
                {activeSubItems.length > 0 &&
                  (cat.key === "LIABILITIES_DEBT" ||
                    cat.key === "DAILY_OPERATIONAL" ||
                    cat.key === "FIXED_ESSENTIALS") && (
                    <div className="pl-4.5 pt-0.5 space-y-1">
                      {activeSubItems.map((sub) => (
                        <div
                          key={sub.key}
                          className="flex items-center justify-between text-[11px] font-mono tabular-nums text-text-secondary"
                        >
                          <span className="font-sans text-text-tertiary truncate mr-2">
                            {sub.label}
                          </span>
                          <span className="shrink-0">
                            {formatRp(sub.amount)}{" "}
                            <span className="text-text-tertiary">
                              ({sub.shareOfIncomePercent.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 8 Columns: Period-by-Period Cashflow & Savings Rate Ledger Table */}
      <div className="col-span-8 rounded-lg border border-border bg-surface overflow-hidden">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans block">
              Period-by-Period Decomposition
            </span>
            <h2 className="text-base font-semibold font-sans text-text-primary mt-0.5">
              Historical Cashflow, Debt Burden & Savings Rate Ledger
            </h2>
          </div>
          <span className="text-xs font-mono text-text-tertiary">
            Target Savings Rate: &ge;{kpis.savingsRateTarget.toFixed(0)}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-subtle/40 text-[10px] font-sans font-semibold uppercase tracking-wider text-text-tertiary whitespace-nowrap">
                <th className="py-2.5 pl-4 pr-1.5">Period</th>
                <th className="py-2.5 px-1.5 text-right">Net Income</th>
                <th className="py-2.5 px-1.5 text-right">Liabilities & Debt</th>
                <th className="py-2.5 px-1.5 text-right">Op. & Fixed</th>
                <th className="py-2.5 px-1.5 text-right">P1 Savings</th>
                <th className="py-2.5 px-1.5 text-right">P2 Surplus</th>
                <th className="py-2.5 px-1.5 text-right">Debt %</th>
                <th className="py-2.5 pl-1.5 pr-4 text-right">Save %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-[11px] font-mono tabular-nums whitespace-nowrap">
              {series.map((row) => {
                const isHeavyDebt = row.creditDebtRatioPercent > 35.0;
                const isOptimalSavings = row.savingsRatePercent >= 20.0;

                return (
                  <tr
                    key={`${row.year}-${row.month}`}
                    className="hover:bg-surface-subtle/40 transition-colors"
                  >
                    <td className="py-3 pl-4 pr-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-text-primary">
                          {row.periodLabel}
                        </span>
                        <span className="text-[10px] font-sans text-text-tertiary">
                          {row.status === "LOCKED" ? "Closed" : "Draft"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-1.5 text-right text-text-primary">
                      {formatRp(row.totalIncome)}
                    </td>
                    <td className="py-3 px-1.5 text-right text-delta-negative">
                      {formatRp(row.creditBillsAmount)}
                    </td>
                    <td className="py-3 px-1.5 text-right text-text-secondary">
                      {formatRp(row.operationalAndFixedOutflow)}
                    </td>
                    <td className="py-3 px-1.5 text-right text-delta-positive font-medium">
                      {formatRp(row.actualSavings)}
                    </td>
                    <td className="py-3 px-1.5 text-right text-text-secondary">
                      {formatRp(row.selfRewardSurplus)}
                    </td>
                    <td
                      className={`py-3 px-1.5 text-right font-medium ${
                        isHeavyDebt
                          ? "text-delta-negative"
                          : "text-delta-positive"
                      }`}
                    >
                      {row.creditDebtRatioPercent.toFixed(1)}%
                    </td>
                    <td
                      className={`py-3 pl-1.5 pr-4 text-right font-medium ${
                        isOptimalSavings
                          ? "text-delta-positive"
                          : row.savingsRatePercent > 0
                          ? "text-caution"
                          : "text-text-tertiary"
                      }`}
                    >
                      {row.savingsRatePercent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-subtle/60 text-[11px] font-mono font-semibold tabular-nums whitespace-nowrap">
                <td className="py-3 pl-4 pr-1.5 font-sans text-text-primary">
                  Total ({periodCount})
                </td>
                <td className="py-3 px-1.5 text-right text-text-primary">
                  {formatRp(kpis.totalIncomeAcrossPeriods)}
                </td>
                <td className="py-3 px-1.5 text-right text-delta-negative">
                  {formatRp(kpis.totalCreditBillsAcrossPeriods)}
                </td>
                <td className="py-3 px-1.5 text-right text-text-secondary">
                  {formatRp(kpis.totalOperationalAndFixedAcrossPeriods)}
                </td>
                <td className="py-3 px-1.5 text-right text-delta-positive">
                  {formatRp(kpis.cumulativePlannedSavings)}
                </td>
                <td className="py-3 px-1.5 text-right text-text-secondary">
                  {formatRp(kpis.totalSelfRewardAcrossPeriods)}
                </td>
                <td className="py-3 px-1.5 text-right text-text-primary">
                  {kpis.overallCreditDebtRatioPercent.toFixed(1)}%
                </td>
                <td className="py-3 pl-1.5 pr-4 text-right text-text-primary">
                  {kpis.aggregateSavingsRate.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

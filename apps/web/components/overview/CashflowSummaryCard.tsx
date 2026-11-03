import React from "react";
import { MonthlySnapshot, DailyPacing } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface CashflowSummaryCardProps {
  snapshot: MonthlySnapshot;
  pacing: DailyPacing | null;
}

export function CashflowSummaryCard({ snapshot, pacing }: CashflowSummaryCardProps) {
  const totalIncome = snapshot.finalTotalIncome ?? snapshot.netSalaryIncome ?? 0;
  const totalDeductions = snapshot.totalDeductions ?? 0;
  const dailySpent = pacing?.totalDailySpent ?? 0;
  const netSurplus = totalIncome - totalDeductions;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border-subtle">
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            CASHFLOW SUMMARY
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            MONTH {snapshot.month} / {snapshot.year}
          </span>
        </div>

        {/* Ledger-like Cashflow Breakdown */}
        <div className="space-y-2.5 text-xs font-sans">
          {/* Total Income */}
          <div className="flex items-center justify-between py-1">
            <span className="text-text-secondary">Total Net Income (Payroll + Adjustments)</span>
            <span className="font-mono tabular-nums text-[13px] font-medium text-delta-positive">
              +{formatRupiah(totalIncome)}
            </span>
          </div>

          {/* Total Liabilities & Deductions */}
          <div className="flex items-center justify-between py-1 border-t border-border-subtle">
            <span className="text-text-secondary">Materialized Liabilities & Debt (Upfront)</span>
            <span className="font-mono tabular-nums text-[13px] font-medium text-text-primary">
              -{formatRupiah(totalDeductions)}
            </span>
          </div>

          {/* Net Remaining Cashflow */}
          <div className="flex items-center justify-between py-2 border-t border-border mt-2">
            <span className="font-medium text-text-primary">Net Waterfall Baseline</span>
            <span
              className={`font-mono tabular-nums text-sm font-semibold ${
                netSurplus >= 0 ? "text-text-primary" : "text-urgency"
              }`}
            >
              {formatRupiah(netSurplus)}
            </span>
          </div>

          {/* Consumption Cycle Daily Spending (tracked against Operational Budget) */}
          {pacing && (
            <div className="flex items-center justify-between pt-1 border-t border-border-subtle/60 text-[11px] text-text-tertiary">
              <span>Daily spending in consumption cycle ({pacing.cycleDateLabel})</span>
              <span className="font-mono tabular-nums text-text-secondary">
                {formatRupiah(dailySpent)}
              </span>
            </div>
          )}
        </div>

        {/* Waterfall Pillar Allocation Breakdown */}
        <div className="mt-4 pt-3 border-t border-border-subtle">
          <div className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
            Waterfall Allocations Status
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
              <div className="text-[10px] text-text-tertiary font-sans">Savings (P1)</div>
              <div className="font-mono text-xs font-medium text-text-primary mt-0.5 tabular-nums">
                {formatRupiah(snapshot.actualSavings ?? 0)}
              </div>
            </div>
            <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
              <div className="text-[10px] text-text-tertiary font-sans">Self-Reward (P2)</div>
              <div className="font-mono text-xs font-medium text-text-primary mt-0.5 tabular-nums flex items-center justify-center gap-1">
                <span>{formatRupiah(snapshot.selfReward ?? 0)}</span>
                {(snapshot.selfReward ?? 0) === 0 && (snapshot.selfRewardTarget ?? 0) > 0 && (
                  <span
                    title={`Target ${formatRupiah(snapshot.selfRewardTarget)} was consumed by higher priority commitments`}
                    className="text-[9px] font-mono text-caution"
                  >
                    (squeezed)
                  </span>
                )}
              </div>
            </div>
            <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
              <div className="text-[10px] text-text-tertiary font-sans">Emergency Buffer</div>
              <div className="font-mono text-xs font-medium text-text-primary mt-0.5 tabular-nums">
                {formatRupiah(snapshot.bufferPocket ?? 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

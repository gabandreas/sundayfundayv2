"use client";

import React from "react";
import { MonthlySnapshot, DailyPacing, resolvePriorityTierLabel } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";

interface CashflowSummaryCardProps {
  snapshot: MonthlySnapshot;
  pacing: DailyPacing | null;
}

export function CashflowSummaryCard({ snapshot, pacing }: CashflowSummaryCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const { studioConfig } = usePerspective();
  const savingsTierLabel = resolvePriorityTierLabel(studioConfig, "SAVINGS", "Core Savings");
  const surplusTierLabel = resolvePriorityTierLabel(studioConfig, "DISCRETIONARY", "Flexible Surplus");
  const totalIncome = snapshot.finalTotalIncome ?? snapshot.netSalaryIncome ?? 0;
  const totalDeductions = snapshot.totalDeductions ?? 0;
  const dailySpent = pacing?.totalDailySpent ?? 0;
  const netSurplus = totalIncome - totalDeductions;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border-subtle">
          <span className="text-[11px] font-semibold text-text-tertiary font-sans">
            {t("overview.cashflowSummary")}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            Period {snapshot.month}/{snapshot.year}
          </span>
        </div>

        {/* Ledger-like Cashflow Breakdown */}
        <div className="space-y-2.5 text-xs font-sans">
          {/* Total Income */}
          <div className="flex items-center justify-between py-1">
            <span className="text-text-secondary">{t("overview.totalNetIncome")}</span>
            <span className="erp-tabular-currency text-[13px] font-medium text-delta-positive">
              +{formatRupiah(totalIncome, isAmountsMasked)}
            </span>
          </div>

          {/* Total Liabilities & Deductions */}
          <div className="flex items-center justify-between py-1 border-t border-border-subtle">
            <span className="text-text-secondary">{t("overview.materializedDebt")}</span>
            <span className="erp-tabular-currency text-[13px] font-medium text-text-primary">
              -{formatRupiah(totalDeductions, isAmountsMasked)}
            </span>
          </div>

          {/* Net Remaining Cashflow */}
          <div className="flex items-center justify-between py-2 border-t border-border mt-2">
            <span className="font-medium text-text-primary">{t("overview.netBaseline")}</span>
            <div className="flex items-center gap-2">
              <span
                className={`erp-tabular-currency text-sm font-semibold ${
                  netSurplus >= 0 ? "text-text-primary" : "text-urgency"
                }`}
              >
                {formatRupiah(netSurplus, isAmountsMasked)}
              </span>
            </div>
          </div>

          {/* Consumption Cycle Daily Spending (tracked against Operational Budget) */}
          {pacing && (
            <div className="flex items-center justify-between pt-1 border-t border-border-subtle/60 text-[11px] text-text-tertiary">
              <span>Daily spending in consumption cycle ({pacing.cycleDateLabel})</span>
              <span className="erp-tabular-currency text-text-secondary">
                {formatRupiah(dailySpent, isAmountsMasked)}
              </span>
            </div>
          )}
        </div>

        {/* Waterfall Pillar Allocation Breakdown */}
        <div className="mt-4 pt-3 border-t border-border-subtle">
          <div className="text-[11px] font-sans text-text-tertiary mb-2">
            Waterfall Allocations Status
          </div>
          <div className="grid grid-cols-3 divide-x divide-border-subtle border-y border-border-subtle py-2.5 text-center">
            <div className="px-2 min-w-0">
              <div className="text-[10px] text-text-tertiary font-sans truncate">{savingsTierLabel}</div>
              <div className="erp-tabular-currency text-xs font-medium text-text-primary mt-0.5">
                {formatRupiah(snapshot.actualSavings ?? 0, isAmountsMasked)}
              </div>
            </div>
            <div className="px-2 min-w-0">
              <div className="text-[10px] text-text-tertiary font-sans truncate">{surplusTierLabel}</div>
              <div className="erp-tabular-currency text-xs font-medium text-text-primary mt-0.5 flex items-center justify-center gap-1">
                <span>{formatRupiah(snapshot.selfReward ?? 0, isAmountsMasked)}</span>
                {(snapshot.selfReward ?? 0) === 0 && (snapshot.selfRewardTarget ?? 0) > 0 && (
                  <span
                    title={`Target ${formatRupiah(snapshot.selfRewardTarget, isAmountsMasked)} was consumed by higher priority commitments`}
                    className="text-[9px] font-mono text-caution"
                  >
                    (squeezed)
                  </span>
                )}
              </div>
            </div>
            <div className="px-2 min-w-0">
              <div className="text-[10px] text-text-tertiary font-sans truncate">Emergency Buffer</div>
              <div className="erp-tabular-currency text-xs font-medium text-text-primary mt-0.5">
                {formatRupiah(snapshot.bufferPocket ?? 0, isAmountsMasked)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

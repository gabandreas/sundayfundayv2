"use client";

import React from "react";
import { WishlistAnalysisResult } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface WishlistAnalysisResultsProps {
  analysis: WishlistAnalysisResult | null;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function WishlistAnalysisResults({
  analysis,
  isLoading,
  errorMessage,
}: WishlistAnalysisResultsProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 space-y-4 animate-pulse">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="h-4 bg-surface-subtle rounded w-48" />
          <div className="h-4 bg-surface-subtle rounded w-24" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 bg-surface-subtle rounded" />
          <div className="h-28 bg-surface-subtle rounded" />
        </div>
        <div className="h-40 bg-surface-subtle rounded" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-[rgba(255,56,56,0.30)] bg-[rgba(255,56,56,0.05)] p-4 text-xs font-sans text-delta-negative">
        <span className="font-semibold block mb-0.5">Simulation Error</span>
        <span>{errorMessage}</span>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-subtle/30 p-8 text-center text-xs font-sans text-text-tertiary">
        Configure purchase parameters on the left and click &quot;Simulate Purchase&quot; to evaluate cash feasibility and installment debt impact.
      </div>
    );
  }

  const { cashStrategy, installmentStrategy } = analysis;

  const isInstantCash = cashStrategy.tier === "INSTANT_EXECUTION";

  return (
    <div className="space-y-5">
      {/* Strategy Layout: 1 card full width for CASH, 2 columns for INSTALLMENT */}
      <div className={installmentStrategy ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "w-full"}>
        {/* Card 1: Cash Purchase Strategy */}
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
                Liquidity Strategy
              </span>
              <h3 className="text-sm font-semibold font-sans text-text-primary mt-0.5">
                Cash Execution
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                isInstantCash
                  ? "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
                  : "bg-[rgba(229,155,44,0.10)] text-caution border-[rgba(229,155,44,0.25)]"
              }`}
            >
              {isInstantCash ? "Instant Purchase Feasible" : "Accumulation Required"}
            </span>
          </div>

          <div
            className={`grid gap-3 text-xs font-sans ${
              installmentStrategy ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
            }`}
          >
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">Current Self-Reward</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-text-primary mt-0.5 block">
                {formatRupiah(cashStrategy.currentSelfReward)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">Funding Shortfall</span>
              <span
                className={`font-mono text-sm font-semibold tabular-nums mt-0.5 block ${
                  cashStrategy.shortfall > 0 ? "text-delta-negative" : "text-delta-positive"
                }`}
              >
                {cashStrategy.shortfall > 0 ? formatRupiah(cashStrategy.shortfall) : "Rp 0 (Fully Funded)"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">Estimated Saving Time</span>
              <span className="font-mono text-sm font-medium tabular-nums text-text-primary mt-0.5 block">
                {isInstantCash
                  ? "0 months (Immediate)"
                  : cashStrategy.estimatedMonthsToSave === Infinity
                  ? "Indefinite (No Allocation)"
                  : `${cashStrategy.estimatedMonthsToSave} month${cashStrategy.estimatedMonthsToSave > 1 ? "s" : ""}`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">Monthly Reward Rate</span>
              <span className="font-mono text-sm font-medium tabular-nums text-text-secondary mt-0.5 block">
                {formatRupiah(cashStrategy.monthlySavingsRate)}/mo
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Installment Strategy Overview (Only shown when installmentStrategy is present) */}
        {installmentStrategy && (
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
                  Leverage Assessment
                </span>
                <h3 className="text-sm font-semibold font-sans text-text-primary mt-0.5">
                  Installment Strategy
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                  installmentStrategy.tier === "OPTIMAL"
                    ? "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
                    : installmentStrategy.tier === "MANAGEABLE"
                    ? "bg-[rgba(229,155,44,0.10)] text-caution border-[rgba(229,155,44,0.25)]"
                    : "bg-[rgba(255,56,56,0.12)] text-urgency border-[rgba(255,56,56,0.35)]"
                }`}
              >
                {installmentStrategy.tier === "OPTIMAL"
                  ? "Optimal (<= 20%)"
                  : installmentStrategy.tier === "MANAGEABLE"
                  ? "Manageable (20% - 35%)"
                  : "High Risk (> 35%)"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-sans">
              <div>
                <span className="text-[10px] text-text-tertiary uppercase block">Peak Debt Ratio</span>
                <span
                  className={`font-mono text-base font-semibold tabular-nums mt-0.5 block ${
                    installmentStrategy.tier === "OPTIMAL"
                      ? "text-delta-positive"
                      : installmentStrategy.tier === "MANAGEABLE"
                      ? "text-caution"
                      : "text-urgency"
                  }`}
                >
                  {installmentStrategy.peakDebtRatio.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-tertiary uppercase block">New Monthly Obligation</span>
                <span className="font-mono text-base font-semibold tabular-nums text-text-primary mt-0.5 block">
                  {formatRupiah(installmentStrategy.newMonthlyInstallment)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6-Month Rolling Debt Ratio Projection (Only shown when installmentStrategy exists) */}
      {installmentStrategy && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div>
              <h4 className="text-xs font-semibold font-sans text-text-primary">
                6-Month Rolling Debt Burden Projection
              </h4>
              <p className="text-[11px] font-sans text-text-tertiary mt-0.5">
                Evaluates existing liabilities combined with the proposed installment against net salary.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-tertiary">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-delta-positive inline-block" /> &lt;=20% Optimal
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-caution inline-block" /> 20-35% Caution
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-urgency inline-block" /> &gt;35% Danger
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  <th className="py-2 text-left font-medium">Period</th>
                  <th className="py-2 text-right font-medium">Existing Liabilities</th>
                  <th className="py-2 text-right font-medium">Proposed Installment</th>
                  <th className="py-2 text-right font-medium">Total Monthly Debt</th>
                  <th className="py-2 text-right font-medium">Debt Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono text-[11px] tabular-nums">
                {installmentStrategy.projectedMonths.map((p, idx) => {
                  const isHigh = p.debtRatio > 35;
                  const isCaution = p.debtRatio > 20 && p.debtRatio <= 35;
                  return (
                    <tr key={idx} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="py-2 text-left font-sans text-text-secondary font-medium">
                        {String(p.month).padStart(2, "0")}/{p.year}
                      </td>
                      <td className="py-2 text-right text-text-tertiary">
                        {formatRupiah(p.existingDebt)}
                      </td>
                      <td className="py-2 text-right text-text-primary">
                        {formatRupiah(p.newDebt)}
                      </td>
                      <td className="py-2 text-right font-medium text-text-primary">
                        {formatRupiah(p.totalDebt)}
                      </td>
                      <td
                        className={`py-2 text-right font-semibold ${
                          isHigh
                            ? "text-urgency"
                            : isCaution
                            ? "text-caution"
                            : "text-delta-positive"
                        }`}
                      >
                        {p.debtRatio.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] font-sans text-text-tertiary pt-2 border-t border-border-subtle">
            Future months without existing payroll data use the current period&apos;s income as an estimate.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { CashflowPeriodEntry, TrajectorySummary } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface CashflowComparisonChartProps {
  series: CashflowPeriodEntry[];
  trajectory: TrajectorySummary;
}

function formatRp(amount: number): string {
  return formatRupiah(amount);
}

export function CashflowComparisonChart({
  series,
  trajectory,
}: CashflowComparisonChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(
    series.length > 0 ? series.length - 1 : 0
  );

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center text-xs font-mono text-text-tertiary">
        No periods available for the selected scope.
      </div>
    );
  }

  const activePeriod = series[selectedIndex] ?? series[series.length - 1];

  // Determine vertical scale from backend-computed period entries
  const maxPeriodValue = series.reduce((max, item) => {
    const highestInPeriod = Math.max(
      item.totalIncome,
      item.totalOutflow,
      item.totalLiabilitiesAndDeductions,
      item.totalRetainedAndSurplus,
      1
    );
    return Math.max(max, highestInPeriod);
  }, 1);

  const chartHeight = 190;
  const barGroupWidth = 104;
  const chartWidth = Math.max(680, series.length * barGroupWidth + 48);

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
      {/* Header & Legend Row */}
      <div className="flex items-start justify-between gap-6 border-b border-border-subtle pb-4">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans block">
            Multi-Period Cashflow & Deleveraging Trajectory
          </span>
          <h2 className="text-base font-semibold font-sans text-text-primary mt-0.5">
            Income vs. Liabilities, Operational Outflow & Retained Surplus
          </h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-sans text-text-secondary pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#8A94A6] inline-block" />
            <span>Total Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#D95B43] inline-block" />
            <span>Liabilities & Debt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#E59B2C] inline-block" />
            <span>Operational & Fixed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#2BB686] inline-block" />
            <span>Savings & Surplus (P1+P2)</span>
          </div>
        </div>
      </div>

      {/* Trajectory Summary Strip (Clean Header Strip — Zero SVG Clutter) */}
      <div className="grid grid-cols-4 gap-4 rounded border border-border-subtle bg-surface-subtle/50 px-4 py-3">
        <div>
          <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
            Peak Liability Burden
          </span>
          {trajectory.peakDebtPeriod ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-delta-negative tabular-nums">
                {trajectory.peakDebtPeriod.debtRatioPercent.toFixed(1)}%
              </span>
              <span className="font-mono text-xs text-text-secondary">
                {trajectory.peakDebtPeriod.periodLabel}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-text-tertiary">—</span>
          )}
        </div>

        <div>
          <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
            Safe Debt Threshold (&le;35%)
          </span>
          {trajectory.debtSafeInflectionPeriod ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-delta-positive tabular-nums">
                {trajectory.debtSafeInflectionPeriod.periodLabel}
              </span>
              <span className="font-mono text-xs text-text-secondary tabular-nums">
                ({trajectory.debtSafeInflectionPeriod.debtRatioPercent.toFixed(1)}%)
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-text-tertiary">
              Not yet reached
            </span>
          )}
        </div>

        <div>
          <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
            Surplus Overtakes Debt
          </span>
          {trajectory.surplusCrossoverPeriod ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-delta-positive tabular-nums">
                {trajectory.surplusCrossoverPeriod.periodLabel}
              </span>
              <span className="font-mono text-xs text-text-secondary tabular-nums">
                {formatRp(trajectory.surplusCrossoverPeriod.totalRetainedAndSurplus)}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-text-tertiary">
              Not in scope
            </span>
          )}
        </div>

        <div>
          <span className="text-[10px] font-sans uppercase tracking-wider text-text-tertiary block">
            Horizon Debt Ratio Shift
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                trajectory.debtRatioDeltaPts <= 0
                  ? "text-delta-positive"
                  : "text-delta-negative"
              }`}
            >
              {trajectory.debtRatioDeltaPts > 0 ? "+" : ""}
              {trajectory.debtRatioDeltaPts.toFixed(1)} pts
            </span>
            <span className="font-mono text-xs text-text-tertiary tabular-nums">
              {trajectory.firstPeriodDebtRatioPercent.toFixed(1)}% &rarr;{" "}
              {trajectory.lastPeriodDebtRatioPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* High-Contrast Grouped Bar SVG Canvas (No Gridlines, No Floating Badges) */}
      <div className="w-full overflow-x-auto pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 38}`}
          className="w-full h-56 select-none"
          role="img"
          aria-label="Multi-period cashflow comparison chart"
        >
          {/* Baseline axis */}
          <line
            x1={16}
            y1={chartHeight}
            x2={chartWidth - 16}
            y2={chartHeight}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />

          {series.map((item, idx) => {
            const groupX = 28 + idx * barGroupWidth;
            const isSelected = idx === selectedIndex;

            const incomeH = Math.max(
              3,
              Math.round((item.totalIncome / maxPeriodValue) * (chartHeight - 16))
            );
            const debtH =
              item.creditBillsAmount > 0
                ? Math.max(
                    3,
                    Math.round(
                      (item.creditBillsAmount / maxPeriodValue) *
                        (chartHeight - 16)
                    )
                  )
                : 0;
            const essentialH =
              item.operationalAndFixedOutflow > 0
                ? Math.max(
                    3,
                    Math.round(
                      (item.operationalAndFixedOutflow / maxPeriodValue) *
                        (chartHeight - 16)
                    )
                  )
                : 0;
            const surplusH =
              item.totalRetainedAndSurplus > 0
                ? Math.max(
                    3,
                    Math.round(
                      (item.totalRetainedAndSurplus / maxPeriodValue) *
                        (chartHeight - 16)
                    )
                  )
                : 0;

            const barW = 15;
            const gap = 4;

            return (
              <g
                key={`${item.year}-${item.month}`}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => setSelectedIndex(idx)}
              >
                {/* Subtle hover/selection column backdrop */}
                <rect
                  x={groupX - 8}
                  y={4}
                  width={barW * 4 + gap * 3 + 16}
                  height={chartHeight + 28}
                  rx={4}
                  fill={
                    isSelected
                      ? "rgba(255, 255, 255, 0.045)"
                      : "transparent"
                  }
                />

                {/* Bar 1: Total Income */}
                <rect
                  x={groupX}
                  y={chartHeight - incomeH}
                  width={barW}
                  height={incomeH}
                  rx={1.5}
                  fill="#8A94A6"
                  opacity={isSelected ? 1 : 0.72}
                />

                {/* Bar 2: Liabilities & Deductions */}
                {debtH > 0 && (
                  <rect
                    x={groupX + (barW + gap)}
                    y={chartHeight - debtH}
                    width={barW}
                    height={debtH}
                    rx={1.5}
                    fill="#D95B43"
                    opacity={isSelected ? 1 : 0.72}
                  />
                )}

                {/* Bar 3: Operational & Fixed Essentials */}
                {essentialH > 0 && (
                  <rect
                    x={groupX + (barW + gap) * 2}
                    y={chartHeight - essentialH}
                    width={barW}
                    height={essentialH}
                    rx={1.5}
                    fill="#E59B2C"
                    opacity={isSelected ? 1 : 0.72}
                  />
                )}

                {/* Bar 4: Retained Savings & Surplus (P1 + P2) */}
                {surplusH > 0 && (
                  <rect
                    x={groupX + (barW + gap) * 3}
                    y={chartHeight - surplusH}
                    width={barW}
                    height={surplusH}
                    rx={1.5}
                    fill="#2BB686"
                    opacity={isSelected ? 1 : 0.72}
                  />
                )}

                {/* Period X-Axis Label */}
                <text
                  x={groupX + (barW * 4 + gap * 3) / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fill={isSelected ? "#F3F5F8" : "#8A94A6"}
                  fontSize="11"
                  fontFamily="var(--font-mono), monospace"
                  fontWeight={isSelected ? "600" : "400"}
                >
                  {item.periodLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Period Inspector Strip */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-border-subtle text-xs whitespace-nowrap overflow-x-auto">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono font-semibold text-text-primary">
            {activePeriod.periodLabel}
          </span>
          <span className="text-text-tertiary font-sans">
            {activePeriod.status === "LOCKED" ? "Closed Period" : "Active Draft"}
          </span>
        </div>

        <div className="flex items-center gap-5 font-mono tabular-nums">
          <div>
            <span className="text-text-tertiary mr-1 font-sans">Income:</span>
            <span className="text-text-primary font-medium">
              {formatRp(activePeriod.totalIncome)}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary mr-1 font-sans">
              Liabilities ({activePeriod.creditDebtRatioPercent.toFixed(1)}%):
            </span>
            <span className="text-delta-negative font-medium">
              {formatRp(activePeriod.creditBillsAmount)}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary mr-1 font-sans">
              Op. & Fixed:
            </span>
            <span className="text-caution font-medium">
              {formatRp(activePeriod.operationalAndFixedOutflow)}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary mr-1 font-sans">
              P1 Savings ({activePeriod.savingsRatePercent.toFixed(1)}%):
            </span>
            <span className="text-delta-positive font-medium">
              {formatRp(activePeriod.actualSavings)}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary mr-1 font-sans">
              P2 Surplus:
            </span>
            <span className="text-text-primary font-medium">
              {formatRp(activePeriod.selfRewardSurplus)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { SavingsMilestone } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface SavingsMilestonesCardProps {
  milestones: SavingsMilestone[];
  currentBalance: number;
  monthlyPace?: number;
}

const MILESTONE_TITLES: Record<number, { title: string; desc: string }> = {
  1: {
    title: "1-Month Core Buffer",
    desc: "Covers one full cycle of rent, bills, and essential daily spending.",
  },
  3: {
    title: "3-Month Safety Net",
    desc: "Essential reserve covering immediate living expenses.",
  },
  6: {
    title: "6-Month Stability Reserve",
    desc: "Reserve against sudden income disruption or transition periods.",
  },
  12: {
    title: "12-Month Extended Reserve",
    desc: "Full one-year liquidity cushion for major obligations.",
  },
};

export function SavingsMilestonesCard({
  milestones,
  currentBalance,
  monthlyPace = 0,
}: SavingsMilestonesCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);
  const starterTarget = 1000000;
  const starterPct = Math.min(100, Math.round((currentBalance / starterTarget) * 100));

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Emergency Reserve Benchmarks
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Starter Rp 1.000.000 cushion plus 3, 6, and 12-month essential expense coverage.
          </p>
        </div>
        <span className="text-xs font-mono text-text-tertiary tabular-nums shrink-0">
          Confirmed: {formatRp(currentBalance)}
        </span>
      </div>

      {/* Starter Benchmark (Rp 1.000.000) */}
      <div className="rounded-md border border-border-subtle bg-surface-subtle/40 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-medium text-xs font-sans text-text-primary">
              Starter Cushion
            </span>
            <span className="text-[11px] font-sans text-text-tertiary ml-2">
              First cash buffer before multi-month reserves
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-text-primary tabular-nums">
              {formatRp(starterTarget)}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                currentBalance >= starterTarget
                  ? "text-delta-positive bg-[rgba(16,183,141,0.10)] border-[rgba(16,183,141,0.25)]"
                  : "text-text-tertiary bg-surface-subtle border-border-subtle"
              }`}
            >
              {currentBalance >= starterTarget ? "Reached" : `${starterPct}%`}
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              currentBalance >= starterTarget ? "bg-delta-positive" : "bg-text-secondary"
            }`}
            style={{ width: `${starterPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 divide-y divide-border-subtle">
        {milestones.map((m) => {
          const info = MILESTONE_TITLES[m.months] || {
            title: `${m.months}-Month Reserve`,
            desc: "Custom reserve target",
          };
          const remaining = Math.max(0, m.targetAmount - currentBalance);
          const estMonths =
            !m.isAchieved && monthlyPace > 0 ? Math.ceil(remaining / monthlyPace) : null;

          return (
            <div key={m.months} className="pt-4 first:pt-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-xs font-sans text-text-primary">
                    {info.title}
                  </span>
                  <span className="text-[11px] font-sans text-text-tertiary ml-2">
                    {info.desc}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-text-primary tabular-nums">
                    {formatRp(m.targetAmount)}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      m.isAchieved
                        ? "text-delta-positive bg-[rgba(16,183,141,0.10)] border-[rgba(16,183,141,0.25)]"
                        : "text-text-tertiary bg-surface-subtle border-border-subtle"
                    }`}
                  >
                    {m.isAchieved ? "Reached" : `${m.progressPercent}%`}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      m.isAchieved ? "bg-delta-positive" : "bg-text-secondary"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, m.progressPercent))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-tertiary">
                  <span>0%</span>
                  <span>
                    {m.isAchieved
                      ? "Target reached"
                      : `Shortfall: ${formatRp(remaining)}${estMonths !== null ? ` (~${estMonths} cycles at current pace)` : ""}`}
                  </span>
                  <span>100% ({formatRp(m.targetAmount)})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

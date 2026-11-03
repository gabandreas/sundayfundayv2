import React from "react";
import { SavingsMilestone } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface SavingsMilestonesCardProps {
  milestones: SavingsMilestone[];
  currentBalance: number;
}

const MILESTONE_TITLES: Record<number, { title: string; desc: string }> = {
  3: {
    title: "3-Month Safety Net",
    desc: "Essential buffer covering immediate living emergencies.",
  },
  6: {
    title: "6-Month Stability Reserve",
    desc: "Resilience against sudden income shock or transition periods.",
  },
  12: {
    title: "12-Month Extended Runway",
    desc: "Comprehensive liquidity for long-term career and financial independence.",
  },
};

export function SavingsMilestonesCard({
  milestones,
  currentBalance,
}: SavingsMilestonesCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Runway Milestones
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Progress toward standardized 3, 6, and 12-month emergency reserves.
          </p>
        </div>
        <span className="text-xs font-mono text-text-tertiary">
          Current: {formatRupiah(currentBalance)}
        </span>
      </div>

      <div className="space-y-4 divide-y divide-border-subtle">
        {milestones.map((m) => {
          const info = MILESTONE_TITLES[m.months] || {
            title: `${m.months}-Month Target`,
            desc: "Custom milestone target",
          };

          return (
            <div key={m.months} className="pt-4 first:pt-0 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-xs font-sans text-text-primary">
                    {info.title}
                  </span>
                  <span className="text-[11px] font-sans text-text-tertiary ml-2 hidden sm:inline">
                    {info.desc}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-primary tabular-nums">
                    {formatRupiah(m.targetAmount)}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      m.isAchieved
                        ? "text-delta-positive bg-[rgba(16,183,141,0.10)] border-[rgba(16,183,141,0.25)]"
                        : "text-text-tertiary bg-surface-subtle border-border-subtle"
                    }`}
                  >
                    {m.isAchieved ? "Achieved" : `${m.progressPercent}%`}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
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
                      : `Deficit: ${formatRupiah(Math.max(0, m.targetAmount - currentBalance))}`}
                  </span>
                  <span>100% ({formatRupiah(m.targetAmount)})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { SelfRewardAuditEntry } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatHumanStatus } from "@/lib/format-labels";

interface AuditRewardsViewProps {
  entries: SelfRewardAuditEntry[];
}

export function AuditRewardsView({ entries }: AuditRewardsViewProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { locale } = useLanguage();
  if (entries.length === 0) {
    return (
      <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
        No self-reward data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-surface-subtle border-b border-border-subtle">
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary w-24">
                Period
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary text-right">
                Target (Rp)
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary text-right">
                Actual (Rp)
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary text-center">
                Status
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary text-right">
                Streak Without Reward
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {entries.map((entry) => {
              const key = `${entry.year}-${entry.month}`;
              return (
                <tr key={key} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-sm text-text-primary tabular-nums">
                    {entry.month}/{entry.year}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">
                    {formatRupiah(entry.targetAmount, isAmountsMasked)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-primary">
                    {formatRupiah(entry.actualAmount, isAmountsMasked)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {entry.isAchieved ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-sans font-medium border bg-delta-positive/10 text-delta-positive border-delta-positive/20">
                        {formatHumanStatus("FUNDED", locale)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-sans font-medium border bg-surface-subtle text-text-tertiary border-border-subtle">
                        {formatHumanStatus("SKIPPED", locale)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">
                    {entry.streakWithoutReward > 0 ? (
                      <span className={entry.streakWithoutReward >= 3 ? "text-urgency font-bold" : ""}>
                        {entry.streakWithoutReward} {entry.streakWithoutReward === 1 ? "month" : "months"}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from "react";
import { DebtBurdenAuditEntry } from "@/lib/api";

interface AuditDebtBurdenViewProps {
  entries: DebtBurdenAuditEntry[];
}

export function AuditDebtBurdenView({ entries }: AuditDebtBurdenViewProps) {
  if (entries.length === 0) {
    return (
      <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
        No debt burden data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-surface-subtle border-b border-border-subtle">
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24">
                Period
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Total Income (Rp)
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Total Bills (Rp)
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Credit Card / Cap
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                PayLater / Cap
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Ratio
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-center">
                Assessment
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
                    {entry.totalIncome.toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-primary">
                    {entry.totalBills.toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    <span
                      className={
                        entry.ccUsageLimit > 0 && entry.ccUsage > entry.ccUsageLimit
                          ? "text-delta-negative font-semibold"
                          : "text-text-primary"
                      }
                    >
                      {(entry.ccUsage ?? 0).toLocaleString("id-ID")}
                    </span>
                    <span className="text-text-tertiary">
                      {entry.ccUsageLimit > 0
                        ? ` / ${entry.ccUsageLimit.toLocaleString("id-ID")}`
                        : " / —"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    <span
                      className={
                        entry.paylaterUsageLimit > 0 &&
                        entry.paylaterUsage > entry.paylaterUsageLimit
                          ? "text-delta-negative font-semibold"
                          : "text-text-primary"
                      }
                    >
                      {(entry.paylaterUsage ?? 0).toLocaleString("id-ID")}
                    </span>
                    <span className="text-text-tertiary">
                      {entry.paylaterUsageLimit > 0
                        ? ` / ${entry.paylaterUsageLimit.toLocaleString("id-ID")}`
                        : " / —"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-primary">
                    {entry.debtRatio.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    {entry.isHeavyBurden || entry.isCreditLimitExceeded ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-urgency/10 text-urgency border-urgency/20">
                        {entry.isCreditLimitExceeded && !entry.isHeavyBurden
                          ? "LIMIT BREACHED"
                          : "HEAVY BURDEN"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-delta-positive/10 text-delta-positive border-delta-positive/20">
                        HEALTHY
                      </span>
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

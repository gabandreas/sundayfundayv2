import React from "react";
import { OperationalAuditEntry } from "@/lib/api";

interface AuditOperationalViewProps {
  entries: OperationalAuditEntry[];
}

export function AuditOperationalView({ entries }: AuditOperationalViewProps) {
  if (entries.length === 0) {
    return (
      <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
        No operational budget data available.
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
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Target (Rp)
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Actual (Rp)
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">
                Shortfall (Rp)
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
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                        entry.status === "HEALTHY"
                          ? "bg-delta-positive/10 text-delta-positive border-delta-positive/20"
                          : entry.status === "TIGHT"
                          ? "bg-caution/10 text-caution border-caution/20"
                          : "bg-urgency/10 text-urgency border-urgency/20"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">
                    {entry.targetAmount.toLocaleString("id-ID")}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm tabular-nums font-medium ${
                      entry.isDeficit ? "text-urgency" : "text-text-primary"
                    }`}
                  >
                    {entry.actualAmount.toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-tertiary">
                    {entry.shortfall > 0 ? entry.shortfall.toLocaleString("id-ID") : "-"}
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

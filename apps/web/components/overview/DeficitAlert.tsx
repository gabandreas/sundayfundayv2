import React from "react";
import { AlertOctagon } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

interface DeficitAlertProps {
  deficitUncovered: number;
}

export function DeficitAlert({ deficitUncovered }: DeficitAlertProps) {
  if (!deficitUncovered || deficitUncovered <= 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[rgba(255,56,56,0.45)] bg-[rgba(255,56,56,0.06)] p-4 flex items-start gap-3.5">
      <AlertOctagon className="w-5 h-5 text-urgency shrink-0 mt-0.5" strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-xs font-semibold font-sans uppercase tracking-wider text-urgency">
            Uncovered Deficit Alert
          </span>
          <span className="font-mono text-xs font-bold text-urgency tabular-nums">
            {formatRupiah(deficitUncovered)}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-secondary font-sans leading-relaxed">
          Total materialized deductions and priority allocations exceed net income for this cycle by{" "}
          <strong className="text-text-primary font-mono tabular-nums">{formatRupiah(deficitUncovered)}</strong>.
          Period closing is locked until spending is reduced, target allocations are revised, or extra windfall income is logged.
        </p>
      </div>
    </div>
  );
}

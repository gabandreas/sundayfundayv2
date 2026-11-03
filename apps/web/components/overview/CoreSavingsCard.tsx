"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MonthlySnapshot } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { EditableTarget } from "./EditableTarget";
import { PrivacyEyeButton } from "@/components/shell/PrivacyEyeButton";

interface CoreSavingsCardProps {
  snapshot: MonthlySnapshot | null;
  isLocked: boolean;
}

export function CoreSavingsCard({ snapshot, isLocked }: CoreSavingsCardProps) {
  const actualSavings = snapshot?.actualSavings ?? 0;
  const targetSavings = snapshot?.savings ?? 0;
  const progressPercent =
    targetSavings > 0
      ? Math.min(100, Math.round((actualSavings / targetSavings) * 100))
      : 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
              Core Savings (P1)
            </span>
            <PrivacyEyeButton />
          </div>
          <span className="text-[10px] font-mono text-text-tertiary">
            Priority 1
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-xl font-semibold leading-none tracking-tight text-text-primary tabular-nums">
            {formatRupiah(actualSavings)}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-text-secondary tabular-nums">
              of {formatRupiah(targetSavings)}
            </span>
            {snapshot && (
              <EditableTarget
                snapshotId={snapshot.id}
                category="SAVINGS"
                categoryLabel="Core Savings"
                currentValue={snapshot.savings}
                isLocked={isLocked}
                revisions={snapshot.budgetRevisions}
              />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5 space-y-1">
          <div className="h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
            <div
              className="h-full bg-delta-positive transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-text-tertiary">
            <span>{progressPercent}% funded</span>
            <span>
              {actualSavings >= targetSavings
                ? "Target met"
                : `Shortfall: ${formatRupiah(targetSavings - actualSavings)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Link to /savings */}
      <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
        <span className="text-[11px] text-text-tertiary font-sans">
          Accumulation Ledger
        </span>
        <Link
          href="/savings"
          className="text-[11px] font-sans font-medium text-accent hover:underline inline-flex items-center gap-1 group"
        >
          <span>View Vault & Goals</span>
          <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}

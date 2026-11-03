"use client";

import React from "react";
import { MonthlySnapshot } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { EditableTarget } from "./EditableTarget";

interface SelfRewardBufferCardProps {
  snapshot: MonthlySnapshot | null;
  isLocked: boolean;
}

export function SelfRewardBufferCard({
  snapshot,
  isLocked,
}: SelfRewardBufferCardProps) {
  const actualSelfReward = snapshot?.selfReward ?? 0;
  const targetSelfReward = snapshot?.selfRewardTarget ?? 0;
  const bufferPocket = snapshot?.bufferPocket ?? 0;
  const isSqueezed = actualSelfReward === 0 && targetSelfReward > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            Self-Reward & Buffer (P2)
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            Secondary Allocations
          </span>
        </div>

        <div className="space-y-2.5 pt-1">
          {/* Self-Reward (P2) */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-text-secondary text-xs font-sans block">
                Self-Reward (P2)
              </span>
              {actualSelfReward < targetSelfReward && (
                <span className="text-[10px] text-text-tertiary font-mono">
                  Target: {formatRupiah(targetSelfReward)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums text-xs font-medium text-text-primary inline-flex items-center gap-1">
                {formatRupiah(actualSelfReward)}
                {isSqueezed && (
                  <span
                    title={`Target ${formatRupiah(targetSelfReward)} was consumed by higher priority commitments`}
                    className="text-[9px] font-mono px-1 py-0.2 rounded border border-[rgba(229,155,44,0.30)] text-caution bg-[rgba(229,155,44,0.08)]"
                  >
                    Squeezed
                  </span>
                )}
              </span>
              {snapshot && (
                <EditableTarget
                  snapshotId={snapshot.id}
                  category="SELF_REWARD"
                  categoryLabel="Self-Reward"
                  currentValue={snapshot.selfRewardTarget}
                  isLocked={isLocked}
                  revisions={snapshot.budgetRevisions}
                />
              )}
            </div>
          </div>

          {/* Emergency Buffer */}
          <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
            <span className="text-text-secondary text-xs font-sans">
              Emergency Buffer
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums text-xs font-medium text-text-primary">
                {formatRupiah(bufferPocket)}
              </span>
              {snapshot && (
                <EditableTarget
                  snapshotId={snapshot.id}
                  category="BUFFER"
                  categoryLabel="Emergency Buffer"
                  currentValue={snapshot.bufferPocket}
                  isLocked={isLocked}
                  revisions={snapshot.budgetRevisions}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

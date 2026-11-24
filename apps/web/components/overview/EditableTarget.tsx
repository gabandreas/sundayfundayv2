"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { BudgetRevision, BudgetRevisionCategory } from "@/lib/api";
import { BudgetRevisionModal } from "./BudgetRevisionModal";
import { BudgetRevisionHistoryPopover } from "./BudgetRevisionHistoryPopover";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";

interface EditableTargetProps {
  snapshotId: number;
  category: BudgetRevisionCategory;
  categoryLabel: string;
  currentValue: number;
  isLocked: boolean;
  lockedReason?: string;
  revisions?: BudgetRevision[];
}

export function EditableTarget({
  snapshotId,
  category,
  categoryLabel,
  currentValue,
  isLocked,
  lockedReason,
  revisions = [],
}: EditableTargetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAmountsMasked, requireUnmasked } = usePrivacyGuard();

  const categoryRevisions = revisions.filter((r) => r.category === category);

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      {categoryRevisions.length > 0 && (
        <BudgetRevisionHistoryPopover
          revisions={categoryRevisions}
          categoryLabel={categoryLabel}
        />
      )}

      <button
        type="button"
        disabled={isLocked}
        onClick={() => {
          if (!requireUnmasked(`Revise ${categoryLabel}`)) return;
          setIsModalOpen(true);
        }}
        title={
          isLocked
            ? lockedReason || "Period is finalized (budget revisions disabled)"
            : isAmountsMasked
            ? `Reveal balances to revise ${categoryLabel} target`
            : `Revise ${categoryLabel} target`
        }
        aria-label={`Revise ${categoryLabel} target`}
        className={`p-1 rounded transition-colors ${
          isLocked
            ? "opacity-30 cursor-not-allowed text-text-tertiary"
            : isAmountsMasked
            ? "opacity-55 text-text-tertiary hover:text-text-primary hover:bg-surface-subtle cursor-pointer"
            : "text-text-tertiary hover:text-text-primary hover:bg-surface-subtle cursor-pointer"
        }`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {!isLocked && (
        <BudgetRevisionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          snapshotId={snapshotId}
          category={category}
          categoryLabel={categoryLabel}
          currentValue={currentValue}
        />
      )}
    </div>
  );
}

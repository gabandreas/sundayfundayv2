"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { BudgetRevision, BudgetRevisionCategory } from "@/lib/api";
import { BudgetRevisionModal } from "./BudgetRevisionModal";
import { BudgetRevisionHistoryPopover } from "./BudgetRevisionHistoryPopover";

interface EditableTargetProps {
  snapshotId: number;
  category: BudgetRevisionCategory;
  categoryLabel: string;
  currentValue: number;
  isLocked: boolean;
  revisions?: BudgetRevision[];
}

export function EditableTarget({
  snapshotId,
  category,
  categoryLabel,
  currentValue,
  isLocked,
  revisions = [],
}: EditableTargetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        onClick={() => setIsModalOpen(true)}
        title={
          isLocked
            ? "Period is finalized — budget revisions disabled"
            : `Revise ${categoryLabel} target`
        }
        aria-label={`Revise ${categoryLabel} target`}
        className={`p-1 rounded transition-colors ${
          isLocked
            ? "opacity-30 cursor-not-allowed text-text-tertiary"
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

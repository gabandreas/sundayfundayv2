"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, History } from "lucide-react";
import { BudgetRevision } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface BudgetRevisionHistoryPopoverProps {
  revisions: BudgetRevision[];
  categoryLabel: string;
}

export function BudgetRevisionHistoryPopover({
  revisions,
  categoryLabel,
}: BudgetRevisionHistoryPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!revisions || revisions.length === 0) {
    return null;
  }

  // Sort descending by date so most recent revision is top
  const sortedRevisions = [...revisions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-border-subtle bg-surface-subtle text-text-secondary hover:text-text-primary hover:border-border transition-colors flex items-center gap-1 cursor-pointer"
        title="View revision audit trail"
      >
        <History className="w-3 h-3 text-text-tertiary" />
        <span>Revised</span>
        {revisions.length > 1 && (
          <span className="text-[9px] text-text-tertiary">({revisions.length})</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-1.5 w-80 rounded-lg border border-border bg-surface p-4 shadow-xl text-left animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border-subtle">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
                Audit Trail
              </span>
              <span className="text-xs font-semibold font-sans text-text-primary">
                {categoryLabel} History
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-text-tertiary hover:text-text-primary p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {sortedRevisions.map((rev) => {
              const date = new Date(rev.createdAt);
              const formattedDate = date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const diff = rev.difference ?? rev.newValue - rev.previousValue;

              return (
                <div
                  key={rev.id}
                  className="p-2.5 rounded bg-surface-subtle border border-border-subtle/80 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-text-tertiary font-mono">
                    <span>{formattedDate}</span>
                    <span
                      className={`font-medium tabular-nums ${
                        diff > 0
                          ? "text-delta-positive"
                          : diff < 0
                          ? "text-delta-negative"
                          : "text-text-tertiary"
                      }`}
                    >
                      {diff > 0 ? `+${formatRupiah(diff)}` : formatRupiah(diff)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-text-primary">
                    <span className="text-text-tertiary line-through">
                      {formatRupiah(rev.previousValue)}
                    </span>
                    <span className="text-text-tertiary">→</span>
                    <span className="font-semibold text-text-primary">
                      {formatRupiah(rev.newValue)}
                    </span>
                  </div>

                  <div className="text-[11px] font-sans text-text-secondary italic pt-0.5 border-t border-border-subtle/40">
                    &ldquo;{rev.reason}&rdquo;
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

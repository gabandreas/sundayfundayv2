"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Transaction, deleteFinanceTransaction } from "@/lib/api";
import { DataTableRow, DataTableHeader } from "@/components/primitives/DataTableRow";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import {
  formatRupiah,
  formatDate,
  formatTransactionType,
  getSourceBadge,
} from "@/lib/utils";

interface RecentTransactionsTableProps {
  transactions: Transaction[];
  isLocked: boolean;
}

export function RecentTransactionsTable({
  transactions,
  isLocked,
}: RecentTransactionsTableProps) {
  const router = useRouter();
  const { isAmountsMasked } = usePrivacyMask();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Take the most recent 10 transactions
  const recentList = transactions.slice(0, 10);

  const handleDelete = async (id: number) => {
    if (isLocked || deletingId !== null) return;
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteFinanceTransaction(id);
      if (!res.success) {
        throw new Error(res.error || "Failed to delete transaction");
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            RECENT TRANSACTIONS
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            ({transactions.length} TOTAL)
          </span>
        </div>
        <span className="text-[11px] font-sans text-text-tertiary">
          {isLocked ? "Read-Only (Locked)" : "Latest 10 entries"}
        </span>
      </div>

      {recentList.length === 0 ? (
        <div className="py-8 text-center text-xs font-sans text-text-tertiary">
          No transactions recorded for this period.
        </div>
      ) : (
        <div>
          <DataTableHeader />
          {recentList.map((tx) => {
            const isManual =
              tx.sourceType === "MANUAL" ||
              tx.sourceType === "OPERATIONAL_REFUND";
            const isIncome = tx.type === "INCOME";
            const amountPrefix = isIncome ? "+" : "-";

            // Delete action button for manual entries when unlocked
            const deleteAction =
              !isLocked && isManual ? (
                <button
                  type="button"
                  onClick={() => handleDelete(tx.id)}
                  disabled={deletingId === tx.id}
                  title="Delete transaction"
                  aria-label="Delete transaction"
                  className="p-1 rounded text-text-tertiary hover:text-delta-negative hover:bg-surface-hover transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              ) : null;

            return (
              <DataTableRow
                key={tx.id}
                date={formatDate(tx.date)}
                title={tx.label}
                category={formatTransactionType(tx.type)}
                badge={getSourceBadge(
                  tx.sourceType,
                  tx.fixedEssentialCategory
                )}
                amount={`${amountPrefix}${formatRupiah(tx.amount, isAmountsMasked)}`}
                type={isIncome ? "income" : "deduction"}
                action={deleteAction}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

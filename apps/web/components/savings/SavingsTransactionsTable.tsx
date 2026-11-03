"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SavingsVault, deleteSavingsTransaction } from "@/lib/api";
import { formatRupiah, formatDate, formatSavingsInstrumentLabel } from "@/lib/utils";
import { DataTableHeader, DataTableRow } from "@/components/primitives/DataTableRow";

interface SavingsTransactionsTableProps {
  transactions: SavingsVault["transactions"];
}

export function SavingsTransactionsTable({
  transactions,
}: SavingsTransactionsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this vault transaction?")) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      const res = await deleteSavingsTransaction(id);
      if (!res.success) {
        setError(res.error || "Failed to delete transaction");
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Vault Transaction History
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Audit log of manual top-ups and emergency withdrawals.
          </p>
        </div>
        <span className="text-xs font-mono text-text-tertiary">
          {transactions.length} total entries
        </span>
      </div>

      {error && (
        <div className="m-4 p-2.5 rounded text-xs font-mono text-delta-negative bg-[rgba(224,108,83,0.10)] border border-[rgba(224,108,83,0.25)]">
          {error}
        </div>
      )}

      <div>
        <DataTableHeader
          dateLabel="DATE"
          titleLabel="REMARK / DESCRIPTION"
          categoryLabel="FLOW TYPE"
          statusLabel=""
          amountLabel="AMOUNT"
        />

        {transactions.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2">
            <div className="text-sm font-medium font-sans text-text-secondary">
              No Vault Activity Recorded
            </div>
            <p className="text-xs font-sans text-text-tertiary max-w-md mx-auto leading-relaxed">
              No manual deposits or emergency withdrawals have been logged yet. Use &ldquo;+ Log Transaction&rdquo; above to record initial liquid reserves or emergency fund adjustments.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {transactions.map((tx) => {
              const isPositive = tx.amount >= 0;
              const formattedAmt = isPositive
                ? `+${formatRupiah(tx.amount)}`
                : formatRupiah(tx.amount);

              return (
                <DataTableRow
                  key={tx.id}
                  date={formatDate(tx.date)}
                  title={tx.label}
                  category={`${
                    isPositive ? "Deposit" : "Withdrawal"
                  } · ${formatSavingsInstrumentLabel(tx.instrumentType)}`}
                  hideStatusColumn={true}
                  amount={formattedAmt}
                  type={isPositive ? "income" : "deduction"}
                  action={
                    <button
                      type="button"
                      disabled={deletingId === tx.id}
                      onClick={() => handleDelete(tx.id)}
                      title="Delete transaction"
                      className="p-1 rounded text-text-tertiary hover:text-delta-negative hover:bg-surface-hover transition-colors disabled:opacity-30 cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

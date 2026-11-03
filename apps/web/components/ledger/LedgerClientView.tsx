"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Transaction,
  MonthlySnapshot,
  DailyPacing,
  deleteFinanceTransaction,
  updateFinanceTransaction,
} from "@/lib/api";
import {
  formatRupiah,
  formatDate,
  getSourceBadge,
  formatTransactionType,
} from "@/lib/utils";
import { DataTableHeader, DataTableRow } from "@/components/primitives/DataTableRow";
import { exportLedgerToExcel } from "@/lib/exportLedgerExcel";
import { CashReconciliationModal } from "@/components/finance/CashReconciliationModal";
import {
  Search,
  Download,
  Trash2,
  Edit2,
  TrendingDown,
  Wallet,
  Sparkles,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface LedgerClientViewProps {
  transactions: Transaction[];
  month: number;
  year: number;
  isLocked: boolean;
  snapshotStatus: string;
  snapshot?: MonthlySnapshot | null;
  pacing?: DailyPacing | null;
}

export type LedgerFilterTab =
  | "ALL"
  | "DAILY_SPEND"
  | "ROUTINE_QUOTAS"
  | "DEBT_BILLS";

export function LedgerClientView({
  transactions,
  month,
  year,
  isLocked,
  snapshotStatus,
  snapshot,
  pacing,
}: LedgerClientViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<LedgerFilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inline edit state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Categorize transactions into the 4 functional buckets
  const categorizedBuckets = useMemo(() => {
    const dailySpend: Transaction[] = [];
    const routineQuotas: Transaction[] = [];
    const debtBills: Transaction[] = [];

    for (const t of transactions) {
      if (t.fixedEssentialCategory) {
        routineQuotas.push(t);
      } else if (
        t.sourceType === "BULK_BILL" ||
        t.sourceType === "CONTRACT" ||
        t.sourceType === "CC_TRANSACTION" ||
        t.sourceType === "PERSONAL_DEBT" ||
        t.type === "CREDIT_BILL"
      ) {
        debtBills.push(t);
      } else {
        // Routine manual spend, refunds, windfalls, and balance checkpoints
        dailySpend.push(t);
      }
    }

    return {
      all: transactions,
      dailySpend,
      routineQuotas,
      debtBills,
    };
  }, [transactions]);

  // Tab filter
  const tabFilteredList = useMemo(() => {
    switch (activeTab) {
      case "DAILY_SPEND":
        return categorizedBuckets.dailySpend;
      case "ROUTINE_QUOTAS":
        return categorizedBuckets.routineQuotas;
      case "DEBT_BILLS":
        return categorizedBuckets.debtBills;
      case "ALL":
      default:
        return categorizedBuckets.all;
    }
  }, [activeTab, categorizedBuckets]);

  // Search filter
  const displayedTransactions = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredList;
    const q = searchQuery.toLowerCase().trim();

    return tabFilteredList.filter((t) => {
      const matchLabel = t.label.toLowerCase().includes(q);
      const matchSource = t.sourceType.toLowerCase().includes(q);
      const matchType = t.type.toLowerCase().includes(q);
      const matchCategory = (t.fixedEssentialCategory || "").toLowerCase().includes(q);
      const matchAmount = t.amount.toString().includes(q);
      const matchDate = t.date.includes(q);
      return (
        matchLabel ||
        matchSource ||
        matchType ||
        matchCategory ||
        matchAmount ||
        matchDate
      );
    });
  }, [tabFilteredList, searchQuery]);

  // Pacing calculations for summary banner in DAILY_SPEND tab
  const startingDailyBudget =
    pacing?.totalOperationalBudget ?? snapshot?.dailyOperational ?? 0;
  const totalBurned =
    pacing?.totalDailySpent ??
    categorizedBuckets.dailySpend
      .filter((t) => t.type === "DEDUCTION")
      .reduce((sum, t) => sum + t.amount, 0);
  const remainingCash =
    pacing?.remainingBudget ?? Math.max(0, startingDailyBudget - totalBurned);

  // Edit handler
  const handleOpenEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditLabel(tx.label);
    setEditAmountStr(tx.amount.toString());
    setEditDate(tx.date.slice(0, 10));
    setUpdateError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const parsedAmount = parseInt(editAmountStr.replace(/\D/g, ""), 10);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setUpdateError("Amount must be a non-negative number.");
      return;
    }
    if (!editLabel.trim()) {
      setUpdateError("Description / label cannot be empty.");
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    const res = await updateFinanceTransaction(editingTransaction.id, {
      label: editLabel.trim(),
      amount: parsedAmount,
      date: editDate || undefined,
    });

    setIsUpdating(false);

    if (res.success) {
      setEditingTransaction(null);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setUpdateError(res.error || "Failed to update transaction.");
    }
  };

  // Delete handler
  const handleDelete = async (id: number, label: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete or revert transaction "${label}"? This will automatically recalculate waterfall totals and daily pacing.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    setErrorMessage(null);
    try {
      const res = await deleteFinanceTransaction(id);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to delete transaction");
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    exportLedgerToExcel({
      month,
      year,
      snapshotStatus,
      transactions,
    });
  };

  return (
    <div className="space-y-4">
      {/* 4-Tab Functional Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Activity", count: transactions.length },
            {
              id: "DAILY_SPEND",
              label: "Balance Checkpoints & Daily Spend",
              count: categorizedBuckets.dailySpend.length,
            },
            {
              id: "ROUTINE_QUOTAS",
              label: "Routine Bill Quotas",
              count: categorizedBuckets.routineQuotas.length,
            },
            {
              id: "DEBT_BILLS",
              label: "Upfront Debt & Credit Bills",
              count: categorizedBuckets.debtBills.length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as LedgerFilterTab)}
                className={`px-3 py-1.5 rounded text-xs font-sans font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? "bg-surface-active text-text-primary border border-border-strong font-semibold shadow-xs"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] text-text-tertiary">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls: Search, Cash Reconciliation & Excel Export */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, amount, date..."
              className="w-48 lg:w-60 pl-8 pr-7 py-1.5 rounded bg-surface-subtle border border-border text-xs font-sans text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          <CashReconciliationModal
            month={month}
            year={year}
            isLocked={isLocked}
          />

          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 rounded text-xs font-medium font-sans bg-surface-subtle hover:bg-surface-hover border border-border text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Export full multi-tab Excel spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-text-secondary" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Banner on Balance Checkpoints & Daily Spend Tab */}
      {activeTab === "DAILY_SPEND" && (
        <div className="rounded-lg border border-border bg-surface-subtle p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface border border-border-subtle flex items-center justify-center text-text-secondary">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">
                Starting Daily Operational Pool
              </span>
              <span className="text-sm font-bold text-text-primary mt-0.5 block">
                {formatRupiah(startingDailyBudget)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface border border-border-subtle flex items-center justify-center text-caution">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">
                Cumulative Burned Spend
              </span>
              <span className="text-sm font-bold text-caution mt-0.5 block">
                {formatRupiah(totalBurned)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface border border-border-subtle flex items-center justify-center text-delta-positive">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">
                Current Remaining Cash
              </span>
              <span className="text-sm font-bold text-delta-positive mt-0.5 block">
                {formatRupiah(remainingCash)}
              </span>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded text-xs font-mono text-delta-negative bg-[rgba(224,108,83,0.10)] border border-[rgba(224,108,83,0.25)]">
          {errorMessage}
        </div>
      )}

      {/* Transaction Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <DataTableHeader
          dateLabel="DATE"
          titleLabel="DESCRIPTION / REMARK"
          categoryLabel="CLASSIFICATION"
          statusLabel="SOURCE"
          amountLabel="AMOUNT / ACTIONS"
        />

        {displayedTransactions.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2">
            <div className="text-sm font-medium font-sans text-text-secondary">
              {transactions.length === 0
                ? "No Transactions Recorded"
                : "No Matching Transactions in this View"}
            </div>
            <p className="text-xs font-sans text-text-tertiary max-w-md mx-auto leading-relaxed">
              {transactions.length === 0
                ? `No manual operational deductions, routine bills, or debt items recorded for ${month.toString().padStart(2, "0")}/${year}.`
                : "No entries match the active tab category or keyword search. Adjust your filters to inspect other activity."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {displayedTransactions.map((tx) => {
              const isIncome = tx.type === "INCOME";
              const formattedAmt = isIncome
                ? `+${formatRupiah(tx.amount)}`
                : `-${formatRupiah(tx.amount)}`;

              // Source badge
              const sourceBadge = getSourceBadge(
                tx.sourceType,
                tx.fixedEssentialCategory
              );

              // Permissions logic:
              const isManualOrRefund =
                tx.sourceType === "MANUAL" ||
                tx.sourceType === "OPERATIONAL_REFUND";
              const canEdit = !isLocked;
              const canDelete = isManualOrRefund && !isLocked;

              return (
                <DataTableRow
                  key={tx.id}
                  date={formatDate(tx.date)}
                  title={tx.label}
                  subtitle={
                    tx.sourceType === "OPERATIONAL_REFUND"
                      ? "Reimbursement / Patungan offset (absorbs into daily spend)"
                      : tx.fixedEssentialCategory
                      ? `Routine Quota Pool (${tx.fixedEssentialCategory.toLowerCase()})`
                      : tx.sourceType !== "MANUAL"
                      ? `Synchronized from ${tx.sourceType.replace(/_/g, " ").toLowerCase()}`
                      : undefined
                  }
                  category={formatTransactionType(tx.type)}
                  badge={
                    sourceBadge
                      ? { text: sourceBadge.text, variant: sourceBadge.variant }
                      : undefined
                  }
                  amount={formattedAmt}
                  type={isIncome ? "income" : "deduction"}
                  action={
                    <div className="flex items-center gap-1">
                      {/* Inline Edit Trigger */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tx)}
                          title="Edit transaction label, amount, or date"
                          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* 1-Click Delete / Revert */}
                      {canDelete ? (
                        <button
                          type="button"
                          disabled={deletingId === tx.id}
                          onClick={() => handleDelete(tx.id, tx.label)}
                          title="Delete / Revert transaction (triggers automatic recalculation)"
                          className="p-1 rounded text-text-tertiary hover:text-delta-negative hover:bg-surface-hover transition-colors disabled:opacity-30 cursor-pointer"
                        >
                          {deletingId === tx.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={
                            isLocked
                              ? "Period is locked against alterations"
                              : "Managed in Credit & Liabilities module"
                          }
                          className="p-1 rounded text-text-tertiary/20 cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Edit Transaction #{editingTransaction.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="p-1 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {updateError && (
                <div className="p-2.5 rounded bg-[rgba(255,56,56,0.10)] border border-[rgba(255,56,56,0.30)] text-xs text-delta-negative flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}

              {/* Description / Label */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
                  Description / Label
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g. Mie Ayam & Es Teh"
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-sans text-text-primary outline-none focus:border-border-strong"
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      editAmountStr
                        ? parseInt(editAmountStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setEditAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary outline-none focus:border-border-strong"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary outline-none focus:border-border-strong"
                />
              </div>

              <div className="p-2.5 rounded bg-surface-subtle border border-border-subtle text-[11px] font-sans text-text-tertiary leading-relaxed">
                Saving changes will immediately update the database and trigger an automatic recalculation of this period&apos;s waterfall quotas and safe-to-spend runway.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  disabled={isUpdating}
                  className="px-3 py-1.5 rounded text-xs font-sans text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-3.5 py-1.5 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Edit2 className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

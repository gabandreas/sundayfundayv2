"use client";

import React, { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Transaction, deleteFinanceTransaction, updateFinanceTransaction } from "@/lib/api";
import { DataTableRow, DataTableHeader } from "@/components/primitives/DataTableRow";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";
import { useLanguage } from "@/context/LanguageContext";
import {
  formatRupiah,
  formatDate,
  formatTransactionType,
  getSourceBadge,
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/lib/utils";

interface RecentTransactionsTableProps {
  transactions: Transaction[];
  isLocked: boolean;
}

type RoutineCategoryOption = "" | "TRANSPORT" | "INTERNET" | "VAPE" | "HAIRCUT";
type PaymentMethodOption = "CASH" | "PAYLATER" | "CC";

export function RecentTransactionsTable({
  transactions,
  isLocked,
}: RecentTransactionsTableProps) {
  const { isAmountsMasked, requireUnmasked } = usePrivacyGuard();
  const { t } = useLanguage();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAmountRaw, setEditAmountRaw] = useState("");
  const [editCategory, setEditCategory] = useState<RoutineCategoryOption>("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethodOption>("CASH");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recentList = transactions.slice(0, 10);

  const handleStartEdit = (tx: Transaction) => {
    if (isLocked) return;
    if (!requireUnmasked("Edit transaction")) return;
    setConfirmDeleteId(null);
    setErrorMsg(null);
    setEditingId(tx.id);
    setEditLabel(tx.label);
    setEditAmountRaw(formatCurrencyInput(tx.amount));
    setEditCategory((tx.fixedEssentialCategory as RoutineCategoryOption) ?? "");
    setEditPaymentMethod("CASH");
  };

  const handleSaveEdit = async (tx: Transaction) => {
    if (isLocked || isSavingEdit) return;
    const parsedAmount = parseCurrencyInput(editAmountRaw);
    if (!editLabel.trim() || parsedAmount <= 0) {
      setErrorMsg("Enter a valid description and positive amount.");
      return;
    }

    setIsSavingEdit(true);
    setErrorMsg(null);
    const res = await updateFinanceTransaction(tx.id, {
      label: editLabel.trim(),
      amount: parsedAmount,
      ...(tx.type === "DEDUCTION" && {
        fixedEssentialCategory: editCategory || null,
        paymentMethod: editPaymentMethod,
      }),
    });
    setIsSavingEdit(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update transaction.");
      return;
    }

    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (isLocked || deletingId !== null) return;
    setDeletingId(id);
    setErrorMsg(null);
    try {
      const res = await deleteFinanceTransaction(id);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to delete transaction");
        return;
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete transaction");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-text-tertiary font-sans">
            {t("overview.recentTransactions")}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            ({transactions.length} entries)
          </span>
        </div>
        <span className="text-[11px] font-sans text-text-tertiary">
          {isLocked ? "Read-Only (Locked)" : "Latest 10 entries"}
        </span>
      </div>

      {errorMsg && (
        <div className="px-4 py-2 border-b border-border-subtle bg-[rgba(224,108,83,0.08)] text-xs font-sans text-delta-negative">
          {errorMsg}
        </div>
      )}

      {recentList.length === 0 ? (
        <div className="py-8 text-center text-xs font-sans text-text-tertiary">
          No transactions recorded.
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
            const isRowEditing = editingId === tx.id;
            const isConfirmingDelete = confirmDeleteId === tx.id;

            const rowActions =
              !isLocked && isManual ? (
                isConfirmingDelete ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="px-1.5 py-0.5 rounded bg-[rgba(224,108,83,0.14)] border border-delta-negative/40 text-[10px] font-mono text-delta-negative hover:opacity-80 disabled:opacity-40 cursor-pointer"
                    >
                      {deletingId === tx.id ? "..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-0.5 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
                      aria-label="Cancel delete"
                    >
                      <X className="w-3 h-3" strokeWidth={1.8} />
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => (isRowEditing ? setEditingId(null) : handleStartEdit(tx))}
                      title="Edit entry"
                      aria-label="Edit transaction"
                      className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!requireUnmasked("Delete transaction")) return;
                        setEditingId(null);
                        setConfirmDeleteId(tx.id);
                      }}
                      disabled={deletingId === tx.id}
                      title="Delete entry"
                      aria-label="Delete transaction"
                      className="p-1 rounded text-text-tertiary hover:text-delta-negative hover:bg-surface-hover transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.8} />
                    </button>
                  </div>
                )
              ) : null;

            const rawBadge = getSourceBadge(tx.sourceType, tx.fixedEssentialCategory);
            const localizedCat =
              tx.type === "INCOME"
                ? t("badge.incomeInflow")
                : tx.type === "CREDIT_BILL"
                  ? t("badge.creditCardBill")
                  : t("badge.dailyLiving");
            const localizedBadge = rawBadge
              ? {
                  ...rawBadge,
                  text:
                    tx.fixedEssentialCategory
                      ? t("badge.routineBill")
                      : tx.sourceType === "BULK_BILL"
                        ? t("badge.paylaterSettlement")
                        : tx.sourceType === "PERSONAL_DEBT"
                          ? t("badge.personalDebt")
                          : tx.sourceType === "OPERATIONAL_REFUND"
                            ? t("badge.operationalRefund")
                            : tx.sourceType === "CONTRACT"
                              ? t("badge.installment")
                              : tx.sourceType === "CC_TRANSACTION"
                                ? t("badge.creditCardBill")
                                : rawBadge.text,
                }
              : undefined;

            return (
              <React.Fragment key={tx.id}>
                <DataTableRow
                  date={formatDate(tx.date)}
                  title={tx.label}
                  category={localizedCat}
                  badge={localizedBadge}
                  amount={`${amountPrefix}${formatRupiah(tx.amount, isAmountsMasked)}`}
                  type={isIncome ? "income" : "deduction"}
                  action={rowActions}
                />
                {isRowEditing && (
                  <div className="px-4 py-2.5 border-b border-border bg-surface-subtle/60 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Description"
                      className="flex-1 min-w-[180px] bg-canvas border border-border rounded px-2 py-1 text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editAmountRaw}
                      onChange={(e) => setEditAmountRaw(formatCurrencyInput(e.target.value))}
                      placeholder="Amount"
                      className="w-32 bg-canvas border border-border rounded px-2 py-1 text-xs font-mono tabular-nums text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                    />
                    {tx.type === "DEDUCTION" && tx.sourceType === "MANUAL" && (
                      <>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as RoutineCategoryOption)}
                          className="bg-canvas border border-border rounded px-2 py-1 text-xs font-mono text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                          aria-label="Routine category"
                        >
                          <option value="">Daily Cash</option>
                          <option value="TRANSPORT">Transport Quota</option>
                          <option value="INTERNET">Internet Quota</option>
                          <option value="VAPE">Vape Quota</option>
                          <option value="HAIRCUT">Haircut Quota</option>
                        </select>
                        <select
                          value={editPaymentMethod}
                          onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethodOption)}
                          className="bg-canvas border border-border rounded px-2 py-1 text-xs font-mono text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                          aria-label="Funding source"
                        >
                          <option value="CASH">Cash Log</option>
                          <option value="PAYLATER">Convert to PayLater</option>
                          <option value="CC">Convert to Credit Card</option>
                        </select>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={() => handleSaveEdit(tx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded erp-btn-primary text-xs font-sans font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-3 h-3" strokeWidth={2} />
                      {isSavingEdit ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 rounded border border-border text-xs font-sans text-text-secondary hover:bg-surface-hover cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

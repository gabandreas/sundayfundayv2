"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCardTransaction,
  deleteCardCharge,
  updateCardCharge,
  settleCardInstallmentEarly,
  stopRecurringCardSubscription,
  resumeRecurringCardSubscription,
} from "@/lib/api";
import { formatDate, formatRupiah, getChargeTypeBadge } from "@/lib/utils";

interface CreditCardTransactionsTableProps {
  transactions: CreditCardTransaction[];
  currentMonth?: number;
  currentYear?: number;
  isLocked?: boolean;
}

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

export function CreditCardTransactionsTable({
  transactions,
  currentMonth = 10,
  currentYear = 2026,
  isLocked = false,
}: CreditCardTransactionsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingEndDateId, setEditingEndDateId] = useState<number | null>(null);
  const [endMonthInput, setEndMonthInput] = useState<number>(currentMonth);
  const [endYearInput, setEndYearInput] = useState<number>(currentYear);
  const [savingEndDate, setSavingEndDate] = useState(false);

  const [settlingCardId, setSettlingCardId] = useState<number | null>(null);
  const [settlementMode, setSettlementMode] = useState<
    "LUMP_SUM_CURRENT_PERIOD" | "MARK_SETTLED_ONLY"
  >("LUMP_SUM_CURRENT_PERIOD");
  const [isSettling, setIsSettling] = useState(false);

  const [stoppingRecurringId, setStoppingRecurringId] = useState<number | null>(null);
  const [submittingRecurring, setSubmittingRecurring] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStopRecurring = async (id: number, mode: "NEXT_MONTH" | "THIS_MONTH") => {
    setSubmittingRecurring(true);
    setErrorMessage(null);
    const stopMonth =
      mode === "NEXT_MONTH"
        ? currentMonth === 12
          ? 1
          : currentMonth + 1
        : currentMonth;
    const stopYear =
      mode === "NEXT_MONTH"
        ? currentMonth === 12
          ? currentYear + 1
          : currentYear
        : currentYear;

    const res = await stopRecurringCardSubscription(id, stopMonth, stopYear);
    setSubmittingRecurring(false);
    setStoppingRecurringId(null);

    if (res.success) {
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to stop recurring subscription");
    }
  };

  const handleResumeRecurring = async (id: number) => {
    setSubmittingRecurring(true);
    setErrorMessage(null);

    const res = await resumeRecurringCardSubscription(id);
    setSubmittingRecurring(false);

    if (res.success) {
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to resume recurring subscription");
    }
  };

  const handleDelete = async (id: number) => {
    if (isLocked || deletingId !== null) return;
    if (!confirm("Are you sure you want to delete this credit card charge?")) {
      return;
    }

    setDeletingId(id);
    setErrorMessage(null);

    const res = await deleteCardCharge(id);
    setDeletingId(null);

    if (res.success) {
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to delete card transaction");
    }
  };

  const handleOpenEndDateEditor = (tx: CreditCardTransaction) => {
    setEditingEndDateId(tx.id);
    setEndMonthInput(tx.endedAtMonth ?? currentMonth);
    setEndYearInput(tx.endedAtYear ?? currentYear);
    setErrorMessage(null);
  };

  const handleSaveEndDate = async (
    cardId: number,
    clearEndDate: boolean = false
  ) => {
    if (savingEndDate) return;
    setSavingEndDate(true);
    setErrorMessage(null);

    const res = await updateCardCharge(cardId, {
      endedAtMonth: clearEndDate ? null : endMonthInput,
      endedAtYear: clearEndDate ? null : endYearInput,
    });

    setSavingEndDate(false);
    if (res.success) {
      setEditingEndDateId(null);
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to update subscription end period");
    }
  };

  const handleConfirmEarlySettlement = async (cardId: number) => {
    if (isSettling) return;
    setIsSettling(true);
    setErrorMessage(null);

    const res = await settleCardInstallmentEarly(cardId, {
      month: currentMonth,
      year: currentYear,
      settlementMode,
    });

    setIsSettling(false);
    if (res.success) {
      setSettlingCardId(null);
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to settle installment early");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Table Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Active Card Charges, Subscriptions & Installments
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Statement cycle {currentMonth}/{currentYear} — track installment slice progress, set recurring end dates, or execute early settlement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/preferences?tab=killswitch"
            className="px-2.5 py-1 rounded text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-subtle border border-border-subtle hover:bg-surface transition-colors"
          >
            Subscription Kill-Switch →
          </Link>
          <span className="text-xs font-mono text-text-tertiary">
            {transactions.length} charges
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-urgency/10 border-b border-urgency/30 text-xs font-sans text-urgency">
          {errorMessage}
        </div>
      )}

      {/* Transactions List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/70 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              <th className="py-2.5 px-3 w-28">TX DATE</th>
              <th className="py-2.5 px-3">DESCRIPTION & SCHEDULE</th>
              <th className="py-2.5 px-3 w-28">CATEGORY</th>
              <th className="py-2.5 px-3 w-36 text-center">TYPE & PROGRESS</th>
              <th className="py-2.5 px-3 w-40 text-right">AMOUNT / DUE</th>
              <th className="py-2.5 px-3 w-44 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-xs">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 px-6 text-center">
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <div className="text-sm font-medium font-sans text-text-secondary">
                      No Active Card Charges
                    </div>
                    <p className="text-xs font-sans text-text-tertiary leading-relaxed">
                      No transactions have been billed against this statement cycle. New charges added below will be matched into monthly cycles by transaction date and statement cutoff.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const badge = getChargeTypeBadge(tx.chargeType);
                const badgeVariantStyles = {
                  default:
                    "bg-surface-active/60 text-text-secondary border-border-subtle",
                  caution:
                    "bg-[rgba(229,155,44,0.10)] text-caution border-[rgba(229,155,44,0.25)]",
                  positive:
                    "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]",
                };

                const prog = tx.installmentProgress;
                const isInstallment = tx.chargeType === "INSTALLMENT";
                const isRecurring = tx.chargeType === "RECURRING";
                const isEditingEnd = editingEndDateId === tx.id;
                const isSettlingRow = settlingCardId === tx.id;

                return (
                  <React.Fragment key={tx.id}>
                    <tr className="hover:bg-surface-hover/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-text-tertiary text-[11px] tabular-nums">
                        {formatDate(tx.transactionDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-text-primary flex items-center gap-2">
                          <span>{tx.label}</span>
                          {tx.status === "SETTLED" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-subtle text-text-tertiary border border-border-subtle">
                              Settled
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-text-tertiary mt-0.5 flex items-center gap-2">
                          <span>
                            Started {tx.billingMonth}/{tx.billingYear}
                          </span>
                          {isRecurring && (
                            <span>
                              ·{" "}
                              {tx.endedAtLabel
                                ? `Ends after ${tx.endedAtLabel}`
                                : "Active indefinitely"}
                            </span>
                          )}
                          {isInstallment && prog && (
                            <span>
                              · Remaining Principal:{" "}
                              {formatRupiah(
                                prog.remainingPrincipalIncludingTarget
                              )}
                            </span>
                          )}
                        </div>
                        {tx.notes && (
                          <div className="text-[11px] text-text-tertiary mt-0.5">
                            {tx.notes}
                          </div>
                        )}
                        {tx.killSwitchEnabled && (
                          <div className="mt-1">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border border-[rgba(16,183,141,0.25)] text-[#10b78d] bg-[rgba(16,183,141,0.08)]">
                              Kill-Switch Armed{tx.promoEndDate ? ` (Ends ${tx.promoEndDate.split("T")[0]})` : ""}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[10px] uppercase text-text-tertiary px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                          {tx.category || "General"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium ${
                              badgeVariantStyles[badge.variant]
                            }`}
                          >
                            {badge.text}
                          </span>
                          {isInstallment && prog?.badgeLabel && (
                            <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-[10px] font-mono font-semibold text-text-primary tabular-nums">
                              Installment {prog.badgeLabel}
                            </span>
                          )}
                          {isRecurring && (
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium ${
                                tx.isActive === false ||
                                (tx.stoppedAtMonth != null && tx.stoppedAtYear != null)
                                  ? "border-[rgba(229,155,44,0.30)] text-caution bg-[rgba(229,155,44,0.08)]"
                                  : "border-[rgba(16,183,141,0.25)] text-delta-positive bg-[rgba(16,183,141,0.08)]"
                              }`}
                            >
                              {tx.isActive === false ||
                              (tx.stoppedAtMonth != null && tx.stoppedAtYear != null)
                                ? `Stopped from ${
                                    tx.stoppedAtMonth
                                      ? `${MONTH_OPTIONS[tx.stoppedAtMonth - 1]?.label} ${tx.stoppedAtYear}`
                                      : "Past"
                                  }`
                                : "Active Monthly"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isInstallment && tx.monthlyAmount ? (
                          <div>
                            <div className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                              {formatRupiah(tx.monthlyAmount)} / mo
                            </div>
                            <div className="text-[10px] font-mono text-text-tertiary tabular-nums">
                              Total:{" "}
                              {formatRupiah(tx.totalAmount ?? tx.amount)} (
                              {tx.tenor} mo)
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                              {formatRupiah(tx.amount)}
                            </span>
                            {tx.dueInPeriod !== undefined &&
                              tx.dueInPeriod === 0 && (
                                <div className="text-[10px] font-mono text-text-tertiary">
                                  Rp 0 due in {currentMonth}/{currentYear}
                                </div>
                              )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {isRecurring && (
                            tx.isActive === false ||
                            (tx.stoppedAtMonth != null && tx.stoppedAtYear != null) ? (
                              <button
                                type="button"
                                disabled={isLocked || submittingRecurring}
                                onClick={() => handleResumeRecurring(tx.id)}
                                className="px-2 py-1 rounded text-[10px] font-sans font-medium bg-[rgba(16,183,141,0.12)] hover:bg-[rgba(16,183,141,0.2)] text-delta-positive border border-[rgba(16,183,141,0.3)] transition-colors cursor-pointer"
                              >
                                {submittingRecurring ? "Resuming..." : "Resume Subscription"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isLocked || submittingRecurring}
                                onClick={() =>
                                  setStoppingRecurringId(
                                    stoppingRecurringId === tx.id ? null : tx.id
                                  )
                                }
                                className="px-2 py-1 rounded text-[10px] font-sans font-medium bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                              >
                                Stop Recurring
                              </button>
                            )
                          )}
                          {isInstallment && prog?.canSettleEarly && (
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => {
                                setSettlingCardId(tx.id);
                                setErrorMessage(null);
                              }}
                              className="px-2 py-1 rounded text-[10px] font-sans font-medium bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              Settle Early
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(tx.id)}
                            disabled={isLocked || deletingId === tx.id}
                            className="text-[11px] font-sans text-text-tertiary hover:text-urgency transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title={
                              isLocked
                                ? "Period is locked"
                                : "Delete transaction"
                            }
                          >
                            {deletingId === tx.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Stop Recurring Selector */}
                    {stoppingRecurringId === tx.id && (
                      <tr className="bg-surface-subtle/70">
                        <td colSpan={6} className="p-3 border-t border-border-subtle">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="text-xs font-sans text-text-secondary">
                              <strong className="text-text-primary">
                                Cancel &ldquo;{tx.label}&rdquo; Recurring Subscription:
                              </strong>{" "}
                              Choose whether to stop from next month or remove immediately from this month.
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={submittingRecurring}
                                onClick={() => handleStopRecurring(tx.id, "NEXT_MONTH")}
                                className="px-2.5 py-1 rounded bg-surface-active hover:bg-surface-hover border border-border text-xs font-sans font-medium text-text-primary cursor-pointer"
                              >
                                Stop from Next Month (
                                {currentMonth === 12 ? 1 : currentMonth + 1}/
                                {currentMonth === 12 ? currentYear + 1 : currentYear}
                                )
                              </button>
                              <button
                                type="button"
                                disabled={submittingRecurring}
                                onClick={() => handleStopRecurring(tx.id, "THIS_MONTH")}
                                className="px-2.5 py-1 rounded bg-[rgba(235,87,87,0.12)] hover:bg-[rgba(235,87,87,0.2)] text-delta-negative border border-[rgba(235,87,87,0.3)] text-xs font-sans font-medium cursor-pointer"
                              >
                                Stop Immediately ({currentMonth}/{currentYear})
                              </button>
                              <button
                                type="button"
                                onClick={() => setStoppingRecurringId(null)}
                                className="px-2 py-1 text-xs font-sans text-text-tertiary hover:text-text-primary cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Inline Subscription End Period Editor */}
                    {isEditingEnd && (
                      <tr className="bg-surface-subtle/70">
                        <td colSpan={6} className="p-3 border-t border-border-subtle">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-xs font-sans text-text-secondary">
                              <strong className="text-text-primary">
                                Effective End Period for &ldquo;{tx.label}&rdquo;:
                              </strong>{" "}
                              Historical months through the selected end period remain intact; all subsequent periods bill Rp 0.
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={endMonthInput}
                                onChange={(e) =>
                                  setEndMonthInput(parseInt(e.target.value, 10))
                                }
                                className="px-2 py-1 rounded bg-surface border border-border text-xs font-mono text-text-primary"
                              >
                                {MONTH_OPTIONS.map((m) => (
                                  <option key={m.value} value={m.value}>
                                    {m.label} ({m.value})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={2026}
                                max={2035}
                                value={endYearInput}
                                onChange={(e) =>
                                  setEndYearInput(
                                    parseInt(e.target.value, 10) || currentYear
                                  )
                                }
                                className="w-20 px-2 py-1 rounded bg-surface border border-border text-xs font-mono text-text-primary"
                              />
                              <button
                                type="button"
                                disabled={savingEndDate}
                                onClick={() => handleSaveEndDate(tx.id, false)}
                                className="px-2.5 py-1 rounded bg-text-primary text-surface text-xs font-sans font-medium cursor-pointer"
                              >
                                {savingEndDate ? "Saving..." : "Apply End Period"}
                              </button>
                              {tx.endedAtMonth && (
                                <button
                                  type="button"
                                  disabled={savingEndDate}
                                  onClick={() => handleSaveEndDate(tx.id, true)}
                                  className="px-2 py-1 rounded border border-border text-xs font-sans text-text-secondary hover:text-text-primary cursor-pointer"
                                >
                                  Clear End Date
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingEndDateId(null)}
                                className="px-2 py-1 text-xs font-sans text-text-tertiary hover:text-text-primary cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Inline Early Settlement Panel */}
                    {isSettlingRow && prog && (
                      <tr className="bg-surface-subtle/70">
                        <td colSpan={6} className="p-3 border-t border-border-subtle">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold font-sans text-text-primary">
                                Early Installment Settlement — {tx.label} (Slice{" "}
                                {prog.badgeLabel})
                              </div>
                              <div className="text-[11px] font-sans text-text-secondary">
                                Remaining principal across{" "}
                                <span className="font-mono font-semibold text-text-primary">
                                  {prog.remainingSlicesIncludingTarget}
                                </span>{" "}
                                unpaid slices:{" "}
                                <span className="font-mono font-semibold text-text-primary">
                                  {formatRupiah(
                                    prog.remainingPrincipalIncludingTarget
                                  )}
                                </span>
                                . Future periods ({currentMonth === 12 ? 1 : currentMonth + 1}/
                                {currentMonth === 12 ? currentYear + 1 : currentYear} onward) will drop to Rp 0.
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={settlementMode}
                                onChange={(e) =>
                                  setSettlementMode(e.target.value as any)
                                }
                                className="px-2.5 py-1 rounded bg-surface border border-border text-xs font-sans text-text-primary"
                              >
                                <option value="LUMP_SUM_CURRENT_PERIOD">
                                  Materialize Lump-Sum ({formatRupiah(prog.remainingPrincipalIncludingTarget)}) in {currentMonth}/{currentYear}
                                </option>
                                <option value="MARK_SETTLED_ONLY">
                                  Mark Remaining Slices Settled Only (Rp 0 in {currentMonth}/{currentYear})
                                </option>
                              </select>
                              <button
                                type="button"
                                disabled={isSettling}
                                onClick={() =>
                                  handleConfirmEarlySettlement(tx.id)
                                }
                                className="px-3 py-1 rounded bg-text-primary text-surface text-xs font-sans font-medium cursor-pointer"
                              >
                                {isSettling ? "Settling..." : "Confirm Payoff"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSettlingCardId(null)}
                                className="px-2 py-1 text-xs font-sans text-text-tertiary hover:text-text-primary cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

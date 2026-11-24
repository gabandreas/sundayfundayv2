"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { MonthlySnapshot, borrowFromP1Vault, resolvePriorityTierLabel } from "@/lib/api";
import { formatRupiah, formatCurrencyInput, parseCurrencyInput } from "@/lib/utils";
import { EditableTarget } from "./EditableTarget";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { useToast } from "@/context/ToastContext";

interface CoreSavingsCardProps {
  snapshot: MonthlySnapshot | null;
  isLocked: boolean;
}

export function CoreSavingsCard({ snapshot, isLocked }: CoreSavingsCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const { studioConfig } = usePerspective();
  const { toast } = useToast();
  const savingsTierLabel = resolvePriorityTierLabel(studioConfig, "SAVINGS", "Core Savings");
  const surplusTierLabel = resolvePriorityTierLabel(studioConfig, "DISCRETIONARY", "Discretionary");
  const actualSavings = snapshot?.actualSavings ?? 0;
  const targetSavings = snapshot?.savings ?? 0;
  const progressPercent =
    targetSavings > 0
      ? Math.min(100, Math.round((actualSavings / targetSavings) * 100))
      : 0;

  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [borrowAmountRaw, setBorrowAmountRaw] = useState("250.000");
  const [destination, setDestination] = useState<"SELF_REWARD" | "LIVING_CASH">("SELF_REWARD");
  const baseMonth = snapshot?.month ?? 10;
  const baseYear = snapshot?.year ?? 2026;
  const futureMonths = Array.from({ length: 6 }, (_, i) => {
    let m = baseMonth + i + 1;
    let y = baseYear;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    return { month: m, year: y, key: `${y}-${m}`, label: `${String(m).padStart(2, "0")}/${y}` };
  });
  const defaultRefund = futureMonths[1] ?? futureMonths[0];
  const [refundKey, setRefundKey] = useState(defaultRefund.key);
  const [reason, setReason] = useState("Temporary transfer for urgent priority purchase");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshot || isLocked) return;
    const amt = parseCurrencyInput(borrowAmountRaw);
    if (amt <= 0) {
      setErrorMsg("Enter an amount greater than Rp 0.");
      return;
    }
    const targetRefund = futureMonths.find((f) => f.key === refundKey) ?? defaultRefund;
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await borrowFromP1Vault(snapshot.id, {
      amount: amt,
      destination,
      refundMonth: targetRefund.month,
      refundYear: targetRefund.year,
      reason: reason.trim() || "Temporary savings advance",
    });
    setIsSubmitting(false);
    if (!res.success) {
      const msg = res.error || "Failed to transfer from savings reserve.";
      setErrorMsg(msg);
      toast({ title: "Transfer failed", description: msg, variant: "error" });
      return;
    }
    toast({
      title: "Savings advance recorded",
      description: `${formatRupiah(amt, false)} transferred cleanly.`,
      variant: "success",
    });
    setIsBorrowModalOpen(false);
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-text-tertiary font-sans">
              {t("overview.coreSavings")}
            </span>
            <span className="text-[10px] font-mono text-text-tertiary">
              {savingsTierLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-semibold leading-none tracking-tight text-text-primary tabular-nums whitespace-nowrap">
                {formatRupiah(actualSavings, isAmountsMasked)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-text-secondary tabular-nums whitespace-nowrap">
                of {formatRupiah(targetSavings, isAmountsMasked)}
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
                  : `Shortfall: ${formatRupiah(targetSavings - actualSavings, isAmountsMasked)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions & Link */}
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-2">
          {snapshot && !isLocked ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsBorrowModalOpen(true);
              }}
              className="text-[11px] font-mono text-text-secondary hover:text-text-primary underline-offset-2 hover:underline cursor-pointer"
            >
              {t("overview.forwardBorrowP1")}
            </button>
          ) : (
            <span className="text-[11px] text-text-tertiary font-sans">
              Accumulation Ledger
            </span>
          )}
          <Link
            href="/savings"
            className="text-[11px] font-sans font-medium text-accent hover:underline inline-flex items-center gap-1 group"
          >
            <span>{t("overview.viewVault")}</span>
            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      {/* Internal Temporary Transfer Modal */}
      {isBorrowModalOpen && snapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsBorrowModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-canvas shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border bg-surface flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold font-sans text-text-primary">
                  Temporary Transfer from {savingsTierLabel}
                </h3>
                <p className="text-xs font-sans text-text-secondary mt-0.5">
                  Moves saved funds into this period and schedules an automatic repayment item in a future cycle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBorrowModalOpen(false)}
                className="p-1 rounded border border-border-subtle text-text-tertiary hover:text-text-primary"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBorrowSubmit} className="p-5 space-y-3.5">
              {errorMsg && (
                <div className="p-2 rounded erp-callout-urgency text-xs text-urgency">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-tertiary">
                  Amount to Borrow (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={borrowAmountRaw}
                  onChange={(e) => setBorrowAmountRaw(formatCurrencyInput(e.target.value))}
                  className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary">
                    Route Funds To
                  </label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value as any)}
                    className="w-full bg-surface-subtle border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary"
                  >
                    <option value="SELF_REWARD">{surplusTierLabel}</option>
                    <option value="LIVING_CASH">Daily Spending Pool</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary">
                    Lock Refund In Period
                  </label>
                  <select
                    value={refundKey}
                    onChange={(e) => setRefundKey(e.target.value)}
                    className="w-full bg-surface-subtle border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary"
                  >
                    {futureMonths.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-tertiary">
                  Purpose / Audit Note
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsBorrowModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border text-xs font-sans text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded erp-btn-primary text-xs font-sans font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? "Processing..." : "Confirm Borrow & Lock Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

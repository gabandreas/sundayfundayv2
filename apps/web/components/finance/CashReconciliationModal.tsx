"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  X,
  AlertTriangle,
  Calculator,
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  previewCashReconciliation,
  executeCashReconciliation,
  CashReconciliationPreview,
  SurplusResolutionMode,
} from "@/lib/api";
import { formatIDR } from "@/lib/utils";

interface CashReconciliationModalProps {
  month: number;
  year: number;
  isLocked: boolean;
  systemRemainingBudget?: number;
}

interface CashAccountRow {
  id: string;
  label: string;
  amount: string;
}

const DEFAULT_ACCOUNTS: CashAccountRow[] = [
  { id: "acc-1", label: "Main Operational Bank Account", amount: "" },
  { id: "acc-2", label: "Digital E-Wallet (GoPay / OVO / Dana)", amount: "" },
  { id: "acc-3", label: "Physical Wallet Cash", amount: "" },
];

export function CashReconciliationModal({
  month,
  year,
  isLocked,
  systemRemainingBudget = 0,
}: CashReconciliationModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [useMultiAccountCounter, setUseMultiAccountCounter] = useState(false);
  const [accounts, setAccounts] = useState<CashAccountRow[]>(DEFAULT_ACCOUNTS);
  const [actualRealBalanceInput, setActualRealBalanceInput] = useState<string>(
    String(Math.max(0, Math.round(systemRemainingBudget)))
  );
  const [surplusResolutionMode, setSurplusResolutionMode] =
    useState<SurplusResolutionMode>("INCREASE_OPERATIONAL_TARGET");
  const [includesUnspentRoutinePool, setIncludesUnspentRoutinePool] =
    useState(false);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<CashReconciliationPreview | null>(
    null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync default input when modal opens
  useEffect(() => {
    if (isOpen) {
      setActualRealBalanceInput(
        String(Math.max(0, Math.round(systemRemainingBudget)))
      );
      setErrorMessage(null);
    }
  }, [isOpen, systemRemainingBudget]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting]);

  // Recompute sum when multi-account counter rows change
  useEffect(() => {
    if (!useMultiAccountCounter) return;
    const sum = accounts.reduce((acc, row) => {
      const parsed = parseInt(row.amount.replace(/\D/g, ""), 10);
      return acc + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);
    setActualRealBalanceInput(String(sum));
  }, [accounts, useMultiAccountCounter]);

  const parsedBalance = Math.max(
    0,
    parseInt(actualRealBalanceInput.replace(/\D/g, ""), 10) || 0
  );

  // Live debounced preview fetch
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingPreview(true);

    const timer = setTimeout(async () => {
      const res = await previewCashReconciliation({
        month,
        year,
        actualRealBalance: parsedBalance,
        surplusResolutionMode,
        includesUnspentRoutinePool,
      });
      if (!cancelled) {
        if (res.success && res.data) {
          setPreview(res.data);
          setErrorMessage(null);
        } else {
          setErrorMessage(res.error || "Failed to simulate reconciliation");
        }
        setIsLoadingPreview(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, month, year, parsedBalance, surplusResolutionMode, includesUnspentRoutinePool]);

  const handleUpdateAccount = (
    id: string,
    field: "label" | "amount",
    value: string
  ) => {
    setAccounts((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleAddAccountRow = () => {
    setAccounts((prev) => [
      ...prev,
      {
        id: `acc-${Date.now()}`,
        label: `Cash Account #${prev.length + 1}`,
        amount: "",
      },
    ]);
  };

  const handleRemoveAccountRow = (id: string) => {
    if (accounts.length <= 1) return;
    setAccounts((prev) => prev.filter((r) => r.id !== id));
  };

  const handleConfirm = async () => {
    if (!preview || preview.resolvedActionType === "NO_OP") return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await executeCashReconciliation({
        month,
        year,
        actualRealBalance: parsedBalance,
        surplusResolutionMode,
        includesUnspentRoutinePool,
        note: note.trim() || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to execute cash reconciliation");
        setIsSubmitting(false);
        return;
      }

      setIsOpen(false);
      setIsSubmitting(false);
      setNote("");
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Unexpected error");
      setIsSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <button
        type="button"
        disabled
        title="Period is locked — cash reconciliation is disabled"
        className="px-2.5 py-1 rounded text-[11px] font-sans font-medium bg-surface-subtle text-text-tertiary border border-border-subtle opacity-60 cursor-not-allowed inline-flex items-center gap-1.5"
      >
        <Scale className="w-3.5 h-3.5" />
        Reconcile Cash
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-2.5 py-1 rounded text-[11px] font-sans font-medium bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors inline-flex items-center gap-1.5 cursor-pointer"
      >
        <Scale className="w-3.5 h-3.5" />
        Reconcile Cash
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-text-secondary" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Real Balance Cash Reconciliation (Cash Opname) · {month}/
                    {year}
                  </h3>
                </div>
                <p className="text-xs text-text-tertiary mt-1">
                  Aligns your real-world liquid operational cash with the ERP&apos;s remaining operational budget and simulates true waterfall + daily pacing impact.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-tertiary hover:text-text-primary rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Current System State Bar */}
              {preview && (
                <div className="grid grid-cols-4 gap-3 p-3.5 rounded bg-surface-subtle border border-border-subtle">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      System Remaining
                    </div>
                    <div className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                      {formatIDR(preview.systemRemainingBudget)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Funded Op. Pocket
                    </div>
                    <div className="font-mono text-sm font-medium text-text-secondary mt-0.5">
                      {formatIDR(preview.current.actualDailyOperational)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Manual Spend
                    </div>
                    <div className="font-mono text-sm font-medium text-text-secondary mt-0.5">
                      {formatIDR(preview.current.totalDailySpent)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Safe Today ({preview.daysRemaining}d left)
                    </div>
                    <div className="font-mono text-sm font-semibold text-positive mt-0.5">
                      {formatIDR(preview.current.safeToSpendToday)}
                    </div>
                  </div>
                </div>
              )}

              {/* Actual Cash Input + Multi-Account Cash Counter Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    Actual Liquid Operational Cash on Hand (IDR)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setUseMultiAccountCounter((prev) => !prev)
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                      useMultiAccountCounter
                        ? "bg-surface-elevated text-text-primary border-text-secondary"
                        : "bg-surface-subtle text-text-secondary border-border hover:text-text-primary"
                    }`}
                  >
                    <Calculator className="w-3 h-3" />
                    {useMultiAccountCounter
                      ? "Hide Multi-Account Cash Counter"
                      : "Use Multi-Account Cash Counter"}
                  </button>
                </div>

                {/* Enhancement 2: Multi-Account Cash Counter */}
                {useMultiAccountCounter && (
                  <div className="p-3.5 rounded bg-surface-subtle/60 border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                      <span>
                        Enter balances across your operational accounts/wallets — sum syncs automatically below.
                      </span>
                      <button
                        type="button"
                        onClick={handleAddAccountRow}
                        className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary font-medium cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add Account Row
                      </button>
                    </div>

                    <div className="space-y-2">
                      {accounts.map((acc) => (
                        <div key={acc.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={acc.label}
                            onChange={(e) =>
                              handleUpdateAccount(
                                acc.id,
                                "label",
                                e.target.value
                              )
                            }
                            className="flex-1 px-2.5 py-1.5 rounded bg-surface border border-border text-xs text-text-primary"
                            placeholder="Account or wallet name"
                          />
                          <input
                            type="number"
                            min={0}
                            value={acc.amount}
                            onChange={(e) =>
                              handleUpdateAccount(
                                acc.id,
                                "amount",
                                e.target.value
                              )
                            }
                            className="w-40 px-2.5 py-1.5 rounded bg-surface border border-border text-xs font-mono text-right text-text-primary"
                            placeholder="0"
                          />
                          {accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAccountRow(acc.id)}
                              className="p-1.5 text-text-tertiary hover:text-negative rounded cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={actualRealBalanceInput}
                      readOnly={useMultiAccountCounter}
                      onChange={(e) =>
                        setActualRealBalanceInput(e.target.value)
                      }
                      className={`w-full px-3 py-2 rounded border border-border font-mono text-sm text-text-primary ${
                        useMultiAccountCounter
                          ? "bg-surface-subtle cursor-not-allowed"
                          : "bg-surface-subtle focus:outline-none focus:border-text-secondary"
                      }`}
                      placeholder="Enter real cash balance..."
                    />
                    <div className="text-[10px] font-mono text-text-tertiary mt-1">
                      Parsed Actual Balance: {formatIDR(parsedBalance)}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-surface-subtle border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-text-secondary"
                      placeholder="Optional note (e.g. Unrecorded cash coffee / parking)"
                    />
                    <div className="text-[10px] text-text-tertiary mt-1">
                      Appended to ledger & governance audit log.
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includesUnspentRoutinePool}
                      onChange={(e) => setIncludesUnspentRoutinePool(e.target.checked)}
                      className="rounded border-border bg-surface-subtle text-accent focus:ring-0"
                    />
                    <span className="text-xs text-text-secondary">
                      Bank balance includes unspent Routine Bills pool
                      {preview?.remainingRoutineBillsPool ? ` (+${formatIDR(preview.remainingRoutineBillsPool)})` : ""}
                    </span>
                  </label>
                  {includesUnspentRoutinePool && preview && (
                    <div className="text-[11px] font-mono text-text-tertiary mt-1 ml-6">
                      Effective Living Cash: {formatIDR(preview.effectiveOperationalCashBalance ?? parsedBalance)}
                    </div>
                  )}
                </div>
              </div>

              {/* Bi-Directional Surplus Resolution Selector (Enhancement 1 & Correction 3) */}
              {preview && preview.discrepancyDirection === "SURPLUS" && (
                <div className="p-3.5 rounded bg-surface-subtle border border-border space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-positive">
                    Cash Surplus Detected (+{formatIDR(preview.adjustmentAmount)}) · Select Resolution Mode
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSurplusResolutionMode("INCREASE_OPERATIONAL_TARGET")
                      }
                      className={`p-2.5 rounded text-left border transition-colors cursor-pointer ${
                        surplusResolutionMode === "INCREASE_OPERATIONAL_TARGET"
                          ? "bg-surface-elevated border-text-primary text-text-primary"
                          : "bg-surface border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <div className="font-semibold text-xs">
                        1. Revise Operational Target (+
                        {formatIDR(preview.adjustmentAmount)})
                      </div>
                      <p className="text-[11px] text-text-tertiary mt-1">
                        Raises Daily Operational target so Remaining Operational Budget matches {formatIDR(preview.actualRealBalance)}.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSurplusResolutionMode("RECORD_OPERATIONAL_REFUND")
                      }
                      className={`p-2.5 rounded text-left border transition-colors cursor-pointer ${
                        surplusResolutionMode === "RECORD_OPERATIONAL_REFUND"
                          ? "bg-surface-elevated border-text-primary text-text-primary"
                          : "bg-surface border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <div className="font-semibold text-xs">
                        2. Operational Refund Offset (+
                        {formatIDR(preview.adjustmentAmount)})
                      </div>
                      <p className="text-[11px] text-text-tertiary mt-1">
                        Offsets Daily Operational Spent (reimbursement / patungan) and restores Remaining Budget without altering targets or income.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSurplusResolutionMode("RECORD_INCOME_ADJUSTMENT")
                      }
                      className={`p-2.5 rounded text-left border transition-colors cursor-pointer ${
                        surplusResolutionMode === "RECORD_INCOME_ADJUSTMENT"
                          ? "bg-surface-elevated border-text-primary text-text-primary"
                          : "bg-surface border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <div className="font-semibold text-xs">
                        3. Record as Extra Income (+
                        {formatIDR(preview.adjustmentAmount)})
                      </div>
                      <p className="text-[11px] text-text-tertiary mt-1">
                        Logs a MANUAL INCOME entry, boosting Total Net Income and P1/P2 Waterfall Surplus.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* True Waterfall + Pacing Simulation Preview (Correction 2) */}
              {preview && (
                <div className="rounded border border-border bg-surface-subtle/40 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-surface-subtle flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                      Simulated Waterfall & Pacing Impact Preview
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        preview.varianceAmount === 0
                          ? "text-text-tertiary"
                          : preview.varianceAmount < 0
                          ? "text-negative"
                          : "text-positive"
                      }`}
                    >
                      Variance:{" "}
                      {preview.varianceAmount > 0 ? "+" : ""}
                      {formatIDR(preview.varianceAmount)} (
                      {preview.discrepancyDirection})
                    </span>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Remaining Operational Budget
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-text-tertiary">
                          {formatIDR(preview.current.remainingBudget)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-text-tertiary" />
                        <span className="font-semibold text-text-primary">
                          {formatIDR(preview.projected.remainingBudget)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Safe-to-Spend Today ({preview.daysRemaining}d remaining)
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-text-tertiary">
                          {formatIDR(preview.current.safeToSpendToday)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-text-tertiary" />
                        <span className="font-semibold text-positive">
                          {formatIDR(preview.projected.safeToSpendToday)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Priority 1 Core Savings Allocation
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-text-tertiary">
                          {formatIDR(preview.current.actualSavings)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-text-tertiary" />
                        <span
                          className={`font-semibold ${
                            preview.impact.reducesPriority1Savings
                              ? "text-caution"
                              : "text-text-primary"
                          }`}
                        >
                          {formatIDR(preview.projected.actualSavings)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Priority 2 Self-Reward Surplus
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-text-tertiary">
                          {formatIDR(preview.current.selfReward)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-text-tertiary" />
                        <span className="font-semibold text-text-primary">
                          {formatIDR(preview.projected.selfReward)}
                        </span>
                      </div>
                    </div>

                    {(preview.current.deficitUncovered > 0 ||
                      preview.projected.deficitUncovered > 0) && (
                      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                        <span className="text-negative font-medium">
                          Uncovered Waterfall Deficit
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-text-tertiary">
                            {formatIDR(preview.current.deficitUncovered)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-text-tertiary" />
                          <span className="font-semibold text-negative">
                            {formatIDR(preview.projected.deficitUncovered)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Waterfall Warnings (Deficit Trap / P1 Savings Squeeze / Income Routing) */}
              {preview && preview.impact.warnings.length > 0 && (
                <div className="space-y-2">
                  {preview.impact.warnings.map((w, idx) => {
                    const isDeficitWarning =
                      preview.impact.triggersWaterfallDeficit ||
                      preview.impact.worsensWaterfallDeficit;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded border flex items-start gap-2.5 text-xs ${
                          isDeficitWarning
                            ? "bg-red-500/10 border-red-500/30 text-negative"
                            : "bg-amber-500/10 border-amber-500/30 text-caution"
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-negative text-xs font-mono">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-surface-subtle flex items-center justify-between">
              <div className="text-[11px] text-text-tertiary">
                {isLoadingPreview
                  ? "Simulating waterfall & pacing..."
                  : preview?.resolvedActionType === "NO_OP"
                  ? "System remaining budget already matches your actual cash balance."
                  : preview?.resolvedActionType ===
                    "RECORD_DEDUCTION_ADJUSTMENT"
                  ? `Will record a MANUAL DEDUCTION of ${formatIDR(preview.adjustmentAmount)}.`
                  : preview?.resolvedActionType === "REVISE_OPERATIONAL_TARGET"
                  ? `Will revise DAILY_OPERATIONAL target to ${formatIDR(preview.projected.dailyOperationalTarget)}.`
                  : preview?.resolvedActionType === "RECORD_INCOME_ADJUSTMENT"
                  ? `Will record a MANUAL INCOME of ${formatIDR(preview.adjustmentAmount)}.`
                  : ""}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary border border-border bg-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    isPending ||
                    isLoadingPreview ||
                    !preview ||
                    preview.resolvedActionType === "NO_OP"
                  }
                  onClick={handleConfirm}
                  className="px-4 py-1.5 rounded text-xs font-semibold bg-text-primary text-canvas hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSubmitting
                    ? "Reconciling..."
                    : "Confirm & Record Adjustment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

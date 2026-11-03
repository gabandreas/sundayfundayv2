"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, AlertTriangle, RefreshCw, Check, X } from "lucide-react";
import { closeSnapshot, recalculateSnapshot, reopenSnapshot } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface ClosePeriodModalProps {
  snapshotId: number;
  month: number;
  year: number;
  isLocked: boolean;
  actualSavings?: number;
  savingsTarget?: number;
  remainingOperational?: number;
  deficitUncovered?: number;
  existingPeriodVaultDeposit?: number;
}

type VaultTransferPreset = "P1_ONLY" | "P1_PLUS_OPERATIONAL" | "SKIP" | "CUSTOM";

export function ClosePeriodModal({
  snapshotId,
  month,
  year,
  isLocked,
  actualSavings = 0,
  savingsTarget = 0,
  remainingOperational = 0,
  deficitUncovered = 0,
  existingPeriodVaultDeposit = 0,
}: ClosePeriodModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isClosing) {
        setIsOpen(false);
        setErrorMessage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isClosing]);

  // Guardrail 2: Over-Sweep Guard on P1 + Unspent Operational
  const safeUnspentOperational =
    deficitUncovered === 0 ? Math.max(0, Math.round(remainingOperational)) : 0;
  const canSweepOperational =
    deficitUncovered === 0 && safeUnspentOperational > 0;

  // Enhancement 2: Duplicate Period Transfer Guard
  const remainingUntransferredP1 = Math.max(
    0,
    Math.round(actualSavings - existingPeriodVaultDeposit)
  );
  const defaultSuggestedAmount =
    existingPeriodVaultDeposit > 0 ? remainingUntransferredP1 : actualSavings;

  const [preset, setPreset] = useState<VaultTransferPreset>(
    defaultSuggestedAmount > 0 ? "P1_ONLY" : "SKIP"
  );
  const [vaultAmountInput, setVaultAmountInput] = useState<string>(
    String(defaultSuggestedAmount)
  );
  const [vaultLabelInput, setVaultLabelInput] = useState<string>(
    `P1 Savings Transfer (${month}/${year})`
  );

  useEffect(() => {
    const nextDefault =
      existingPeriodVaultDeposit > 0
        ? Math.max(0, Math.round(actualSavings - existingPeriodVaultDeposit))
        : Math.max(0, Math.round(actualSavings));
    setPreset(nextDefault > 0 ? "P1_ONLY" : "SKIP");
    setVaultAmountInput(String(nextDefault));
    setVaultLabelInput(`P1 Savings Transfer (${month}/${year})`);
  }, [actualSavings, existingPeriodVaultDeposit, month, year]);

  const [isReopening, setIsReopening] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);

  const handleReopenPeriod = async () => {
    setIsReopening(true);
    setErrorMessage(null);
    try {
      const res = await reopenSnapshot(snapshotId);
      if (res.success) {
        setShowReopenConfirm(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMessage(res.error || "Failed to reopen period");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error while reopening period");
    } finally {
      setIsReopening(false);
    }
  };

  if (isLocked) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowReopenConfirm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-sans font-medium bg-surface-subtle hover:bg-surface-active text-text-primary border border-border hover:border-border-strong transition-colors cursor-pointer"
        >
          <Unlock className="w-3.5 h-3.5 text-text-secondary" />
          <span>Reopen Period</span>
        </button>

        {showReopenConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
              <div className="flex items-start justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-text-primary" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Reopen Period {month}/{year}?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReopenConfirm(false)}
                  className="p-1 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded bg-surface-subtle border border-border-subtle text-xs font-sans text-text-secondary leading-relaxed space-y-2">
                <p>
                  Reopening this period reverts its status back to <strong>DRAFT</strong>.
                </p>
                <p>
                  This permits administrative corrections, transaction modifications, and budget adjustments. The period will automatically recalculate waterfall numbers upon edit.
                </p>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded bg-[rgba(255,56,56,0.10)] border border-[rgba(255,56,56,0.30)] text-xs text-delta-negative">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowReopenConfirm(false)}
                  disabled={isReopening}
                  className="px-3 py-1.5 rounded text-xs font-sans text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReopenPeriod}
                  disabled={isReopening}
                  className="px-3.5 py-1.5 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isReopening ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Reopen</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleSelectPreset = (nextPreset: VaultTransferPreset) => {
    setPreset(nextPreset);
    if (nextPreset === "P1_ONLY") {
      const amt =
        existingPeriodVaultDeposit > 0 ? remainingUntransferredP1 : actualSavings;
      setVaultAmountInput(String(Math.max(0, amt)));
      setVaultLabelInput(`P1 Savings Transfer (${month}/${year})`);
    } else if (nextPreset === "P1_PLUS_OPERATIONAL" && canSweepOperational) {
      const baseP1 =
        existingPeriodVaultDeposit > 0 ? remainingUntransferredP1 : actualSavings;
      setVaultAmountInput(String(Math.max(0, baseP1 + safeUnspentOperational)));
      setVaultLabelInput(
        `P1 Savings + Operational Surplus (${month}/${year})`
      );
    } else if (nextPreset === "SKIP") {
      setVaultAmountInput("0");
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setErrorMessage(null);
    try {
      const res = await recalculateSnapshot(snapshotId);
      if (res.success) {
        setRecalcSuccess(true);
        startTransition(() => {
          router.refresh();
        });
        setTimeout(() => setRecalcSuccess(false), 2000);
      } else {
        setErrorMessage(res.error || "Recalculation failed");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleClosePeriod = async () => {
    setIsClosing(true);
    setErrorMessage(null);

    const parsedTopup = Math.max(
      0,
      parseInt(vaultAmountInput.replace(/\D/g, ""), 10) || 0
    );

    try {
      const res = await closeSnapshot(snapshotId, {
        vaultTopupAmount: parsedTopup,
        vaultTopupLabel:
          parsedTopup > 0
            ? vaultLabelInput.trim() || `P1 Savings Transfer (${month}/${year})`
            : undefined,
      });
      if (res.success) {
        setIsOpen(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMessage(res.error || "Failed to close period");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error during period close");
    } finally {
      setIsClosing(false);
    }
  };

  const parsedTopupPreview = Math.max(
    0,
    parseInt(vaultAmountInput.replace(/\D/g, ""), 10) || 0
  );

  return (
    <div className="flex items-center gap-2">
      {/* Manual Recalculate Trigger */}
      <button
        type="button"
        onClick={handleRecalculate}
        disabled={isRecalculating}
        title="Trigger manual recalculation of waterfall allocations and pacing"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-sans font-medium bg-surface-subtle hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border transition-colors disabled:opacity-50 cursor-pointer"
      >
        {recalcSuccess ? (
          <>
            <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
            <span className="text-delta-positive">Recalculated</span>
          </>
        ) : (
          <>
            <RefreshCw
              className={`w-3.5 h-3.5 text-text-tertiary ${isRecalculating ? "animate-spin" : ""}`}
              strokeWidth={1.8}
            />
            <span>Recalculate</span>
          </>
        )}
      </button>

      {/* Close Period Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-sans font-medium bg-surface hover:bg-surface-hover text-text-primary border border-border hover:border-text-secondary transition-colors cursor-pointer"
      >
        <Lock className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.8} />
        <span>Close Period</span>
      </button>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-period-title"
            className="w-full max-w-xl rounded-lg border border-border bg-surface p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-caution shrink-0" strokeWidth={1.8} />
                <div>
                  <h3
                    id="close-period-title"
                    className="text-base font-semibold font-sans text-text-primary tracking-tight"
                  >
                    Close Financial Period: {month}/{year}
                  </h3>
                  <p className="text-xs font-sans text-text-tertiary mt-0.5">
                    Irreversible snapshot finalization, contract amortization, and optional Vault transfer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isClosing) {
                    setIsOpen(false);
                    setErrorMessage(null);
                  }
                }}
                disabled={isClosing}
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            {/* Error Message from backend guard (e.g. chronological order) */}
            {errorMessage && (
              <div className="p-3 rounded bg-[rgba(224,108,83,0.10)] border border-[rgba(224,108,83,0.30)] text-xs font-sans text-delta-negative leading-relaxed">
                <div className="font-medium mb-0.5">Cannot Close Period</div>
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Step 4: Vault Auto-Suggest at Close Period */}
            <div className="p-4 rounded border border-border-subtle bg-surface-subtle/40 space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div>
                  <div className="text-xs font-semibold font-sans text-text-primary">
                    Savings Vault Transfer (Priority 1 Realization)
                  </div>
                  <div className="text-[11px] font-sans text-text-secondary">
                    Allocated P1 Savings:{" "}
                    <span className="font-mono text-text-primary font-semibold">
                      {formatRupiah(actualSavings)}
                    </span>{" "}
                    <span className="text-text-tertiary">
                      (Target: {formatRupiah(savingsTarget)})
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-delta-positive font-semibold">
                  {parsedTopupPreview > 0
                    ? `+${formatRupiah(parsedTopupPreview)} to Vault`
                    : "Skip Transfer (Rp 0)"}
                </span>
              </div>

              {/* Enhancement 2: Duplicate Period Transfer Warning */}
              {existingPeriodVaultDeposit > 0 && (
                <div className="p-2.5 rounded border border-[rgba(229,155,44,0.30)] bg-[rgba(229,155,44,0.08)] text-[11px] font-sans text-caution">
                  <strong>Already Deposited:</strong>{" "}
                  <span className="font-mono">
                    {formatRupiah(existingPeriodVaultDeposit)}
                  </span>{" "}
                  is already recorded in the Savings Vault for period {month}/{year}.
                  {remainingUntransferredP1 > 0
                    ? ` Remaining untransferred P1 savings: ${formatRupiah(remainingUntransferredP1)}.`
                    : " Defaulting suggested transfer to Rp 0 to prevent double-counting."}
                </div>
              )}

              {/* Enhancement 1: One-Click Composition Presets (with Guardrail 2 Over-Sweep Guard) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("P1_ONLY")}
                  disabled={isClosing}
                  className={`px-2.5 py-1 rounded text-[11px] font-sans border transition-colors cursor-pointer ${
                    preset === "P1_ONLY"
                      ? "bg-surface-active border-text-secondary text-text-primary font-medium"
                      : "bg-surface border-border-subtle text-text-secondary hover:text-text-primary"
                  }`}
                >
                  P1 Savings Only (
                  <span className="font-mono">
                    {formatRupiah(
                      existingPeriodVaultDeposit > 0
                        ? remainingUntransferredP1
                        : actualSavings
                    )}
                  </span>
                  )
                </button>

                {canSweepOperational && (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("P1_PLUS_OPERATIONAL")}
                    disabled={isClosing}
                    className={`px-2.5 py-1 rounded text-[11px] font-sans border transition-colors cursor-pointer ${
                      preset === "P1_PLUS_OPERATIONAL"
                        ? "bg-surface-active border-text-secondary text-text-primary font-medium"
                        : "bg-surface border-border-subtle text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    P1 + Unspent Operational (
                    <span className="font-mono">
                      {formatRupiah(
                        (existingPeriodVaultDeposit > 0
                          ? remainingUntransferredP1
                          : actualSavings) + safeUnspentOperational
                      )}
                    </span>
                    )
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSelectPreset("SKIP")}
                  disabled={isClosing}
                  className={`px-2.5 py-1 rounded text-[11px] font-sans border transition-colors cursor-pointer ${
                    preset === "SKIP"
                      ? "bg-surface-active border-text-secondary text-text-primary font-medium"
                      : "bg-surface border-border-subtle text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Skip Transfer (Rp 0)
                </button>
              </div>

              {/* Editable Amount & Label */}
              <div className="grid grid-cols-12 gap-3 pt-1">
                <div className="col-span-5">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1">
                    VAULT DEPOSIT AMOUNT (IDR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={vaultAmountInput}
                    onChange={(e) => {
                      setVaultAmountInput(e.target.value);
                      setPreset("CUSTOM");
                    }}
                    disabled={isClosing}
                    className="w-full px-2.5 py-1.5 rounded bg-surface border border-border focus:border-accent text-xs font-mono tabular-nums text-text-primary outline-none"
                  />
                </div>
                <div className="col-span-7">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1">
                    VAULT LEDGER DESCRIPTION
                  </label>
                  <input
                    type="text"
                    value={vaultLabelInput}
                    onChange={(e) => setVaultLabelInput(e.target.value)}
                    disabled={isClosing || parsedTopupPreview === 0}
                    placeholder={`P1 Savings Transfer (${month}/${year})`}
                    className="w-full px-2.5 py-1.5 rounded bg-surface border border-border focus:border-accent text-xs font-sans text-text-primary outline-none disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="text-[10px] font-sans text-text-tertiary">
                Period tag <span className="font-mono">({month}/{year})</span> is automatically preserved on the Vault entry for deterministic period attribution.
              </div>
            </div>

            {/* Explanatory summary of atomic actions */}
            <div className="space-y-2 text-xs font-sans text-text-secondary">
              <p className="text-text-primary font-medium">
                Confirming period close executes the following operations atomically:
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-text-secondary leading-relaxed pl-1">
                <li>
                  <strong className="text-text-primary">Final Recalculation:</strong> Runs authoritative payroll, waterfall deductions, and daily pacing calculations one final time.
                </li>
                <li>
                  <strong className="text-text-primary">Contract Amortization:</strong> Decrements remaining tenor by 1 month for all active credit contracts (contracts reaching 0 are retired).
                </li>
                <li>
                  <strong className="text-text-primary">Snapshot Lock:</strong> Transitions period {month}/{year} status to <span className="font-mono text-text-primary font-semibold">LOCKED</span>. All mutations for this period will be permanently rejected.
                </li>
                {parsedTopupPreview > 0 && (
                  <li>
                    <strong className="text-text-primary">Vault Top-Up:</strong> Records a <span className="font-mono text-delta-positive font-semibold">+{formatRupiah(parsedTopupPreview)}</span> deposit in the Savings Vault attributed to <span className="font-mono">({month}/{year})</span>.
                  </li>
                )}
              </ul>
            </div>

            {/* Notice on chronological guard */}
            <div className="p-2.5 rounded bg-surface-subtle border border-border-subtle text-[11px] font-sans text-text-tertiary leading-relaxed">
              <strong>Chronological Rule:</strong> Periods must be closed in strict chronological order. A period cannot be closed if any earlier period remains open as DRAFT.
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage(null);
                }}
                disabled={isClosing}
                className="px-3.5 py-1.5 rounded text-xs font-sans font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClosePeriod}
                disabled={isClosing}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-sans font-medium bg-urgency hover:bg-urgency/90 text-white transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isClosing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
                    <span>Closing Period...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>
                      {parsedTopupPreview > 0
                        ? `Confirm Lock & Deposit ${formatRupiah(parsedTopupPreview)}`
                        : "Confirm & Lock Period"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

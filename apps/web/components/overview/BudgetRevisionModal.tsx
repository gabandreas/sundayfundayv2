"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Check, AlertCircle, RefreshCw } from "lucide-react";
import { createBudgetRevision, previewBudgetRevision, BudgetRevisionCategory, BudgetRevisionPreview } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface BudgetRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId: number;
  category?: BudgetRevisionCategory;
  bucketKey?: string;
  categoryLabel: string;
  currentValue: number;
  onSuccess?: () => void;
}

export function BudgetRevisionModal({
  isOpen,
  onClose,
  snapshotId,
  category,
  bucketKey,
  categoryLabel,
  currentValue,
  onSuccess,
}: BudgetRevisionModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [newValueStr, setNewValueStr] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [preview, setPreview] = useState<BudgetRevisionPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewValueStr(String(currentValue));
      setReason("");
      setErrorMessage(null);
      setIsSuccess(false);
      setPreview(null);
    }
  }, [isOpen, currentValue]);

  const parsedValue = parseFloat(newValueStr);
  const validNumber = !isNaN(parsedValue) && parsedValue >= 0;
  const difference = validNumber ? parsedValue - currentValue : 0;
  const isChanged = validNumber && parsedValue !== currentValue;
  const canSubmit =
    validNumber &&
    isChanged &&
    reason.trim().length >= 3 &&
    !isSubmitting &&
    !isSuccess;

  useEffect(() => {
    if (!isOpen || !validNumber) {
      setPreview(null);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await previewBudgetRevision(snapshotId, {
          category,
          bucketKey,
          bucketLabel: categoryLabel,
          newValue: parsedValue,
        });
        if (res.success && res.data) {
          setPreview(res.data);
        } else {
          setPreview(null);
        }
      } catch {
        setPreview(null);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen, snapshotId, category, bucketKey, categoryLabel, newValueStr, validNumber, parsedValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createBudgetRevision(snapshotId, {
        category,
        bucketKey,
        bucketLabel: categoryLabel,
        newValue: parsedValue,
        reason: reason.trim(),
      });
      if (!res.success) {
        throw new Error(res.error || "Failed to record budget revision");
      }
      setIsSuccess(true);
      startTransition(() => {
        router.refresh();
      });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record budget revision";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-subtle"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              Budget Target Revision
            </div>
            <h2
              id="modal-title"
              className="text-base font-semibold font-sans text-text-primary mt-0.5"
            >
              Revise {categoryLabel} Target
            </h2>
            <p className="text-xs font-sans text-text-tertiary mt-1">
              Mid-period budget adjustment with permanent audit trail.
            </p>
          </div>

          {/* Current vs New preview */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded bg-surface-subtle border border-border-subtle text-xs font-sans">
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">Current Target</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-text-secondary mt-0.5 block">
                {formatRupiah(currentValue)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary uppercase block">Proposed Delta</span>
              <span
                className={`font-mono text-sm font-semibold tabular-nums mt-0.5 block ${
                  difference > 0
                    ? "text-delta-positive"
                    : difference < 0
                    ? "text-delta-negative"
                    : "text-text-tertiary"
                }`}
              >
                {difference > 0 ? `+${formatRupiah(difference)}` : formatRupiah(difference)}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-target-input"
                className="block text-xs font-medium font-sans text-text-secondary mb-1"
              >
                New Target Amount (Rp)
              </label>
              <input
                id="new-target-input"
                type="number"
                min="0"
                step="1000"
                value={newValueStr}
                onChange={(e) => setNewValueStr(e.target.value)}
                disabled={isSubmitting || isSuccess}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-surface-subtle border border-border rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active transition-colors"
                placeholder="e.g. 2800000"
                required
              />
              {validNumber && (
                <span className="text-[11px] font-mono text-text-tertiary mt-1 block">
                  Preview: {formatRupiah(parsedValue)}
                </span>
              )}
            </div>

            {/* Projected Impact Preview Card */}
            {validNumber && (
              <div className="p-3 rounded bg-surface-subtle border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                    Projected Downstream Impact
                  </span>
                  {isPreviewLoading && (
                    <span className="text-[10px] font-mono text-text-tertiary animate-pulse">
                      Calculating...
                    </span>
                  )}
                </div>
                {preview ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-text-tertiary block">Actual Daily Ops</span>
                      <span className="font-mono font-medium text-text-primary">
                        {formatRupiah(preview.projected.actualDailyOperational)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-tertiary block">Actual Savings</span>
                      <span className="font-mono font-medium text-text-primary">
                        {formatRupiah(preview.projected.actualSavings)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-tertiary block">Safe-to-Spend / Day</span>
                      <span className="font-mono font-medium text-text-primary">
                        {formatRupiah(preview.projected.safeToSpendToday)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-tertiary block">Deficit Status</span>
                      <span
                        className={`font-mono font-medium ${
                          preview.projected.deficitUncovered > 0
                            ? "text-delta-negative"
                            : "text-delta-positive"
                        }`}
                      >
                        {preview.projected.deficitUncovered > 0
                          ? `Deficit ${formatRupiah(preview.projected.deficitUncovered)}`
                          : "Fully Funded"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] font-sans text-text-tertiary">
                    {isPreviewLoading ? "Fetching projection..." : "Enter a target amount to preview downstream changes."}
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="reason-input"
                className="block text-xs font-medium font-sans text-text-secondary mb-1"
              >
                Reason for Revision <span className="text-delta-negative">*</span>
              </label>
              <textarea
                id="reason-input"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting || isSuccess}
                className="w-full px-3 py-2 text-xs font-sans bg-surface-subtle border border-border rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active transition-colors resize-none"
                placeholder="Reason is required for audit trail (min. 3 characters)..."
                required
              />
              <span className="text-[10px] font-sans text-text-tertiary mt-0.5 block">
                Recorded to append-only audit log with severity ADJUSTMENT.
              </span>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 p-2.5 rounded bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-xs text-delta-negative">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-sans font-medium text-text-secondary hover:text-text-primary rounded border border-border-subtle hover:border-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-1.5 text-xs font-sans font-medium text-white bg-accent hover:bg-accent-hover rounded transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-delta-positive" />
                    <span>Revision Saved</span>
                  </>
                ) : (
                  <span>Commit Revision</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

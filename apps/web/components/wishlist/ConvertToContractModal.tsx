"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WishlistItem, convertWishlistToContract } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { AlertTriangle, X, RefreshCw, CheckCircle2 } from "lucide-react";

interface ConvertToContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WishlistItem | null;
  onSuccess?: () => void;
}

export function ConvertToContractModal({
  isOpen,
  onClose,
  item,
  onSuccess,
}: ConvertToContractModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !item) {
    return null;
  }

  const effectiveTenor = item.tenor && item.tenor > 0 ? item.tenor : 1;
  const effectiveMonthlyPayment =
    item.monthlyPayment !== null && item.monthlyPayment !== undefined
      ? item.monthlyPayment
      : item.price / effectiveTenor;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await convertWishlistToContract(item.id);
      if (res.success) {
        setIsSuccess(true);
        startTransition(() => {
          router.refresh();
        });
        setTimeout(() => {
          setIsSuccess(false);
          onSuccess?.();
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || "Failed to convert item to contract.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to convert item.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-caution shrink-0" strokeWidth={1.8} />
            <div>
              <h3
                id="convert-modal-title"
                className="text-base font-semibold font-sans text-text-primary tracking-tight"
              >
                Convert to Active Credit Contract
              </h3>
              <p className="text-xs font-sans text-text-tertiary mt-0.5">
                Materialize wishlist planning into a formal financial obligation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Warning Box */}
        <div className="p-3 rounded bg-[rgba(229,155,44,0.06)] border border-[rgba(229,155,44,0.25)] text-xs font-sans text-text-secondary leading-relaxed">
          This action will create an active <span className="font-semibold text-text-primary">CreditContract</span> and permanently lock this wishlist item as <span className="font-semibold text-text-primary">PURCHASED</span>. The resulting installment will enter all rolling liability schedules and monthly budget deductions.
        </div>

        {/* Contract Parameter Breakdown */}
        <div className="rounded border border-border-subtle bg-surface-subtle p-3.5 space-y-2 text-xs font-sans">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1">
            Contract Specification Preview
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-text-tertiary block">Contract Label</span>
              <span className="font-medium text-text-primary truncate block">{item.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary block">Principal Amount</span>
              <span className="font-mono tabular-nums text-text-primary block font-medium">
                {formatRupiah(item.price)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary block">Monthly Installment</span>
              <span className="font-mono tabular-nums text-delta-negative block font-semibold">
                {formatRupiah(effectiveMonthlyPayment)}/mo
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-tertiary block">Tenor Duration</span>
              <span className="font-mono tabular-nums text-text-primary block font-medium">
                {effectiveTenor} months
              </span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-2.5 rounded bg-[rgba(255,56,56,0.08)] border border-[rgba(255,56,56,0.25)] text-xs text-delta-negative">
            {errorMessage}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isSuccess}
            className="px-3.5 py-1.5 text-xs font-sans font-medium text-text-secondary hover:text-text-primary rounded border border-border-subtle hover:border-border transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || isSuccess}
            className="px-4 py-1.5 text-xs font-sans font-medium text-white bg-accent hover:bg-accent-hover rounded transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Creating Contract...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-delta-positive" />
                <span>Contract Created</span>
              </>
            ) : (
              <span>Confirm & Create Contract</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

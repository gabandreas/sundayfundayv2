"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { dispatchOptimisticMatrixBulk, updateBulkBillCell } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface InlineBulkBillCellProps {
  bulkBillId?: number;
  month: number;
  year: number;
  field: "paylaterAmount" | "personalDebtAmount";
  initialAmount: number;
  itemCount?: number;
  unpaidAmount?: number;
  settledCount?: number;
  isCurrentMonth?: boolean;
  disabled?: boolean;
  periodLimit?: number;
  safeHeadroom?: number;
  onOpenDrawer?: () => void;
}

/**
 * Evaluates a user-entered currency string or signed arithmetic expression.
 * - "+92000" or "-50000" adjusts relative to `baseAmount`.
 * - "2243391+150000" or "2.243.391 + 150.000" sums signed terms left-to-right.
 * - "2393391" or "2.393.391" replaces directly.
 */
export function evaluateMathExpression(raw: string, baseAmount: number): number {
  const cleaned = raw.replace(/[.,\s_]/g, "");
  if (!cleaned) return 0;

  if (/^[+-]\d+$/.test(cleaned)) {
    return Math.max(0, baseAmount + parseInt(cleaned, 10));
  }

  if (/^\d+([+-]\d+)+$/.test(cleaned)) {
    const tokens = cleaned.match(/[+-]?\d+/g) ?? [];
    const total = tokens.reduce((sum, token) => sum + parseInt(token, 10), 0);
    return Math.max(0, total);
  }

  const fallback = parseInt(cleaned.replace(/\D/g, ""), 10);
  return Number.isFinite(fallback) ? Math.max(0, fallback) : baseAmount;
}

export function InlineBulkBillCell({
  bulkBillId,
  month,
  year,
  field,
  initialAmount,
  itemCount = 0,
  unpaidAmount,
  settledCount = 0,
  isCurrentMonth = false,
  disabled = false,
  periodLimit = 0,
  safeHeadroom = 0,
  onOpenDrawer,
}: InlineBulkBillCellProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(initialAmount || ""));
  const [optimisticAmount, setOptimisticAmount] = useState<number | null>(null);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedOnEnterRef = useRef(false);

  const displayedAmount = optimisticAmount ?? initialAmount;

  useEffect(() => {
    setOptimisticAmount(null);
    setInputValue(initialAmount ? String(initialAmount) : "");
  }, [initialAmount]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    committedOnEnterRef.current = false;
    setErrorMessage(null);
    setInputValue(displayedAmount ? String(displayedAmount) : "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    committedOnEnterRef.current = false;
    setIsEditing(false);
    setInputValue(displayedAmount ? String(displayedAmount) : "");
    setErrorMessage(null);
  };

  const handleSave = async () => {
    const prevAmount = displayedAmount;
    const numericValue = evaluateMathExpression(inputValue, prevAmount);
    setIsEditing(false);
    if (numericValue === prevAmount) {
      return;
    }

    setErrorMessage(null);
    setOptimisticAmount(numericValue);
    setIsJustSaved(true);
    dispatchOptimisticMatrixBulk({
      month,
      year,
      field,
      value: numericValue,
    });

    const result = await updateBulkBillCell({
      id: bulkBillId,
      month,
      year,
      field,
      value: numericValue,
    });

    if (result.success) {
      setTimeout(() => setIsJustSaved(false), 1200);
    } else {
      setIsJustSaved(false);
      setOptimisticAmount(null);
      dispatchOptimisticMatrixBulk({
        month,
        year,
        field,
        value: prevAmount,
      });
      setErrorMessage(result.error || "Save failed");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      committedOnEnterRef.current = true;
      void handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      committedOnEnterRef.current = true;
      handleCancel();
    }
  };

  const handleBlur = () => {
    if (committedOnEnterRef.current) {
      committedOnEnterRef.current = false;
      return;
    }
    void handleSave();
  };

  if (isEditing) {
    const previewNumeric = evaluateMathExpression(inputValue, displayedAmount);
    const hasExpression = /[+-]/.test(inputValue.trim());
    const isOverConfiguredLimit =
      field === "paylaterAmount" && periodLimit > 0 && previewNumeric > periodLimit;
    const isOverSafeHeadroom =
      field === "paylaterAmount" && safeHeadroom > 0 && previewNumeric > safeHeadroom;

    return (
      <div className="relative w-full py-0.5 px-0.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="+92000 or total"
          title="Enter exact total or +delta / -delta expression (Enter to save, Esc to cancel)"
          className={`w-full bg-surface-subtle border rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-text-primary focus:outline-none tabular-nums ${
            isOverConfiguredLimit || isOverSafeHeadroom
              ? "border-delta-negative"
              : "border-accent"
          }`}
        />
        {hasExpression && !errorMessage && (
          <div className="text-[9px] font-mono text-text-tertiary text-right mt-0.5 tabular-nums">
            = {formatRupiah(previewNumeric, isAmountsMasked)}
          </div>
        )}
        {(isOverConfiguredLimit || isOverSafeHeadroom) && !errorMessage && (
          <div className="mt-1 p-1.5 w-48 bg-surface border border-delta-negative/50 rounded shadow-md text-[9px] font-sans text-delta-negative text-left leading-tight">
            {isOverConfiguredLimit
              ? `Exceeds period PayLater cap (${formatRupiah(periodLimit)})`
              : `Exceeds safe PayLater headroom (${formatRupiah(safeHeadroom)})`}
          </div>
        )}
        {errorMessage && (
          <div className="mt-1 p-1 bg-surface erp-callout-urgency rounded shadow-md text-[9px] font-sans text-urgency text-left">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  const isEmpty = displayedAmount === 0;
  const allSettled = itemCount > 0 && settledCount === itemCount;
  const hasPartialSettlement =
    itemCount > 0 &&
    unpaidAmount !== undefined &&
    unpaidAmount > 0 &&
    unpaidAmount < displayedAmount;

  return (
    <div
      className={`group relative py-1 px-1.5 text-right transition-colors duration-100 rounded select-none border ${
        isJustSaved
          ? "border-delta-positive/50 bg-[rgba(16,183,141,0.08)]"
          : isEmpty
          ? `border-dashed ${
              disabled
                ? "border-border-subtle/40 opacity-50"
                : "border-border/70 hover:border-text-secondary/60 hover:bg-surface-hover/50"
            }`
          : disabled
          ? "border-transparent"
          : "border-transparent hover:bg-surface-hover/70 hover:border-border"
      } ${isCurrentMonth && !isJustSaved ? "bg-surface-active/20" : ""}`}
    >
      {/* Mode A: Click value for quick inline edit */}
      <button
        type="button"
        onClick={handleStartEdit}
        disabled={disabled}
        title={disabled ? "Target period is locked" : "Click figure for inline edit (+delta / -delta or total)"}
        className={`w-full text-right font-mono text-[11px] tabular-nums whitespace-nowrap block ${
          disabled ? "cursor-not-allowed" : "cursor-text"
        }`}
      >
        {isJustSaved ? (
          <span className="inline-flex items-center justify-end gap-1 text-text-primary font-medium">
            <span>{formatRupiah(displayedAmount, isAmountsMasked)}</span>
            <Check className="w-3 h-3 text-delta-positive" strokeWidth={1.8} />
          </span>
        ) : isEmpty ? (
          <span className="text-[10px] text-text-tertiary/70 group-hover:text-text-primary">
            + Add
          </span>
        ) : (
          <span className="text-text-primary font-medium">
            {formatRupiah(displayedAmount, isAmountsMasked)}
          </span>
        )}
      </button>

      {/* Mode B: Secondary trigger for slide-over Itemized Drawer */}
      {onOpenDrawer && (itemCount > 0 || !disabled) && (
        <div className="flex justify-end mt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer();
            }}
            title="Open itemized breakdown, split, cutoff shift, or settlement status"
            className={`text-[9px] font-mono tabular-nums transition-colors cursor-pointer ${
              allSettled
                ? "text-delta-positive hover:underline"
                : itemCount > 0
                ? "text-text-tertiary hover:text-text-primary underline-offset-2 hover:underline"
                : "opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary"
            }`}
          >
            {allSettled
              ? `${itemCount} paid`
              : hasPartialSettlement
              ? `${itemCount} items · ${formatRupiah(unpaidAmount ?? 0, isAmountsMasked)} due`
              : itemCount > 0
              ? `${itemCount} ${itemCount === 1 ? "item" : "items"}`
              : "Details"}
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-0.5 p-1 bg-surface erp-callout-urgency rounded text-[9px] font-sans text-urgency text-left">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

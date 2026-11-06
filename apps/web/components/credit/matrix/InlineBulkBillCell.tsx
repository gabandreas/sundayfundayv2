"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { updateBulkBillCell } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface InlineBulkBillCellProps {
  bulkBillId?: number;
  month: number;
  year: number;
  field: "paylaterAmount" | "personalDebtAmount";
  initialAmount: number;
  isCurrentMonth?: boolean;
  disabled?: boolean;
  periodLimit?: number;
  safeHeadroom?: number;
}

export function InlineBulkBillCell({
  bulkBillId,
  month,
  year,
  field,
  initialAmount,
  isCurrentMonth = false,
  disabled = false,
  periodLimit = 0,
  safeHeadroom = 0,
}: InlineBulkBillCellProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(initialAmount || ""));
  const [isSaving, setIsSaving] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPending = isSaving || isRefreshing;

  useEffect(() => {
    setInputValue(initialAmount ? String(initialAmount) : "");
  }, [initialAmount]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled || isPending) return;
    setErrorMessage(null);
    setInputValue(initialAmount ? String(initialAmount) : "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue(initialAmount ? String(initialAmount) : "");
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (isPending) return;
    const numericValue = parseInt(inputValue.replace(/\D/g, ""), 10) || 0;
    if (numericValue === initialAmount) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const result = await updateBulkBillCell({
      id: bulkBillId,
      month,
      year,
      field,
      value: numericValue,
    });

    setIsSaving(false);

    if (result.success) {
      setIsEditing(false);
      setIsJustSaved(true);
      setTimeout(() => setIsJustSaved(false), 1500);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setErrorMessage(result.error || "Save failed");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    const typedNumeric = parseInt(inputValue.replace(/\D/g, ""), 10) || 0;
    const isOverConfiguredLimit =
      field === "paylaterAmount" && periodLimit > 0 && typedNumeric > periodLimit;
    const isOverSafeHeadroom =
      field === "paylaterAmount" &&
      safeHeadroom > 0 &&
      typedNumeric > safeHeadroom;

    return (
      <div className="relative w-full py-0.5 px-0.5">
        <input
          ref={inputRef}
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isPending}
          placeholder="0"
          className={`w-full bg-surface-subtle border rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-text-primary focus:outline-none tabular-nums ${
            isOverConfiguredLimit || isOverSafeHeadroom
              ? "border-delta-negative"
              : "border-accent"
          }`}
        />
        {(isOverConfiguredLimit || isOverSafeHeadroom) && !errorMessage && (
          <div className="absolute top-full right-0 z-20 mt-1 p-1.5 w-48 bg-surface border border-delta-negative/50 rounded shadow-md text-[9px] font-sans text-delta-negative text-left leading-tight">
            {isOverConfiguredLimit
              ? `Exceeds period PayLater cap (${formatRupiah(periodLimit)})`
              : `Exceeds safe PayLater headroom (${formatRupiah(safeHeadroom)})`}
          </div>
        )}
        {errorMessage && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 p-1 bg-surface border border-urgency/50 rounded shadow-md text-[9px] font-sans text-urgency">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  const isEmpty = initialAmount === 0;

  // Empty editable cell: distinct dashed border + muted "+ Add" ghost placeholder
  if (isEmpty) {
    return (
      <div
        onClick={handleStartEdit}
        title={disabled ? "Target period is locked" : "Click to add entry"}
        className={`group relative py-1 px-2 text-right transition-all duration-150 rounded select-none border ${
          isJustSaved && !isPending
            ? "border-delta-positive/50 bg-[rgba(16,183,141,0.08)]"
            : "border-dashed " +
              (disabled
                ? "border-border-subtle/40 opacity-40 cursor-not-allowed"
                : "border-border/70 hover:border-text-secondary/60 hover:bg-surface-hover/70 cursor-pointer")
        } ${isCurrentMonth && !isJustSaved ? "bg-surface-active/25" : "bg-surface-subtle/20"}`}
      >
        <div className="flex items-center justify-end gap-1">
          {isPending ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" strokeWidth={1.8} />
              <span>Syncing...</span>
            </span>
          ) : isJustSaved ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-delta-positive">
              <Check className="w-3 h-3" strokeWidth={1.8} />
              <span>Saved</span>
            </span>
          ) : (
            <span className="font-mono text-[10px] text-text-tertiary/60 group-hover:text-text-primary transition-colors whitespace-nowrap">
              + Add
            </span>
          )}
        </div>
        {errorMessage && (
          <div className="absolute top-full right-0 z-20 mt-0.5 p-1 bg-surface border border-urgency/50 rounded text-[9px] font-sans text-urgency">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // Populated editable cell: clean tabular amount synced strictly from server initialAmount
  return (
    <div
      onClick={handleStartEdit}
      title={disabled ? "Target period is locked" : "Click to edit"}
      className={`group relative py-1 px-1.5 text-right transition-colors duration-100 rounded select-none border ${
        isJustSaved && !isPending
          ? "border-delta-positive/50 bg-[rgba(16,183,141,0.08)]"
          : disabled
          ? "border-transparent cursor-not-allowed opacity-75"
          : "border-transparent cursor-pointer hover:bg-surface-hover/80 hover:border-border"
      } ${isCurrentMonth && !isJustSaved ? "bg-surface-active/20" : ""}`}
    >
      <span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-text-primary font-medium inline-flex items-center gap-1">
        {isPending ? (
          <span className="inline-flex items-center gap-1 text-text-tertiary">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" strokeWidth={1.8} />
            <span>Syncing...</span>
          </span>
        ) : isJustSaved ? (
          <>
            <span>{formatRupiah(initialAmount)}</span>
            <Check className="w-3 h-3 text-delta-positive" strokeWidth={1.8} />
          </>
        ) : (
          formatRupiah(initialAmount)
        )}
      </span>
      {errorMessage && (
        <div className="absolute top-full right-0 z-20 mt-0.5 p-1 bg-surface border border-urgency/50 rounded text-[9px] font-sans text-urgency">
          {errorMessage}
        </div>
      )}
    </div>
  );
}


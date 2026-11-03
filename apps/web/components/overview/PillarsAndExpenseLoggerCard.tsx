"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Lock, Check } from "lucide-react";
import {
  MonthlySnapshot,
  createExpenseTransaction,
  FixedEssentialCategory,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { EditableTarget } from "./EditableTarget";

interface PillarsAndExpenseLoggerCardProps {
  snapshot: MonthlySnapshot | null;
  month: number;
  year: number;
  isLocked: boolean;
}

type ExpenseMode = "OPERATIONAL" | "FIXED_ESSENTIAL" | "OPERATIONAL_REFUND";

const PRESET_AMOUNTS = [
  { label: "15k", value: 15000 },
  { label: "25k", value: 25000 },
  { label: "50k", value: 50000 },
  { label: "100k", value: 100000 },
];

const FIXED_ESSENTIAL_OPTIONS: Array<{
  value: FixedEssentialCategory;
  label: string;
}> = [
  { value: "TRANSPORT", label: "Transport (Fuel / Grab / KRL)" },
  { value: "INTERNET", label: "Internet & Data Package" },
  { value: "VAPE", label: "Vape Supplies & Liquid" },
  { value: "HAIRCUT", label: "Haircut & Grooming" },
];

export function PillarsAndExpenseLoggerCard({
  snapshot,
  month,
  year,
  isLocked,
}: PillarsAndExpenseLoggerCardProps) {
  const router = useRouter();
  const descInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>("OPERATIONAL");
  const [fixedEssentialCategory, setFixedEssentialCategory] =
    useState<FixedEssentialCategory>("TRANSPORT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    label?: string;
    amount?: string;
    general?: string;
  }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [, startTransition] = useTransition();

  // Keyboard shortcut "N" to focus Quick Expense input
  useEffect(() => {
    if (isLocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        descInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked]);

  const handlePresetClick = (presetValue: number) => {
    setAmount(presetValue.toString());
    setFieldErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLocked) return;

    const errors: { label?: string; amount?: string } = {};

    if (!label.trim()) {
      errors.label = "Description is required";
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      errors.amount = "Amount must be greater than Rp 0";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await createExpenseTransaction({
        month,
        year,
        label: label.trim(),
        amount: numAmount,
        date: new Date().toISOString(),
        fixedEssentialCategory:
          expenseMode === "FIXED_ESSENTIAL"
            ? fixedEssentialCategory
            : undefined,
        isOperationalRefund: expenseMode === "OPERATIONAL_REFUND",
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to record transaction");
      }

      setLabel("");
      setAmount("");
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);

      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      const error = err as Error;
      setFieldErrors({ general: error.message || "Error saving transaction" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAllocated =
    (snapshot?.actualSavings ?? 0) +
    (snapshot?.selfReward ?? 0) +
    (snapshot?.bufferPocket ?? 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between h-full space-y-4">
      {/* TOP HALF: WATERFALL PILLARS */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            WATERFALL PILLARS
          </span>
          <span className="text-[10px] font-sans text-text-tertiary">
            Reservoirs
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-mono text-[22px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
            {formatRupiah(totalAllocated)}
          </span>
          <span className="text-xs font-sans text-text-tertiary">allocated</span>
        </div>

        <div className="pt-2.5 border-t border-border-subtle space-y-2 text-xs font-sans">
          {/* Savings (P1) */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-text-secondary text-[11px] block">Savings (P1):</span>
              {(snapshot?.actualSavings ?? 0) < (snapshot?.savings ?? 0) && (
                <span className="text-[9px] text-text-tertiary font-mono">
                  Target: {formatRupiah(snapshot?.savings ?? 0)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums text-xs font-medium text-text-primary">
                {formatRupiah(snapshot?.actualSavings ?? 0)}
              </span>
              {snapshot && (
                <EditableTarget
                  snapshotId={snapshot.id}
                  category="SAVINGS"
                  categoryLabel="Savings"
                  currentValue={snapshot.savings}
                  isLocked={isLocked}
                  revisions={snapshot.budgetRevisions}
                />
              )}
            </div>
          </div>

          {/* Self-Reward (P2) */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-text-secondary text-[11px] block">Self-Reward (P2):</span>
              {(snapshot?.selfReward ?? 0) < (snapshot?.selfRewardTarget ?? 0) && (
                <span className="text-[9px] text-text-tertiary font-mono">
                  Target: {formatRupiah(snapshot?.selfRewardTarget ?? 0)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums text-xs font-medium text-text-primary inline-flex items-center gap-1">
                {formatRupiah(snapshot?.selfReward ?? 0)}
                {(snapshot?.selfReward ?? 0) === 0 && (snapshot?.selfRewardTarget ?? 0) > 0 && (
                  <span
                    title={`Target ${formatRupiah(snapshot?.selfRewardTarget ?? 0)} was consumed by higher priority commitments`}
                    className="text-[9px] font-mono px-1 py-0.2 rounded border border-[rgba(229,155,44,0.30)] text-caution bg-[rgba(229,155,44,0.08)]"
                  >
                    Squeezed
                  </span>
                )}
              </span>
              {snapshot && (
                <EditableTarget
                  snapshotId={snapshot.id}
                  category="SELF_REWARD"
                  categoryLabel="Self-Reward"
                  currentValue={snapshot.selfRewardTarget}
                  isLocked={isLocked}
                  revisions={snapshot.budgetRevisions}
                />
              )}
            </div>
          </div>

          {/* Emergency Buffer */}
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-[11px]">Emergency Buffer:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums text-xs font-medium text-text-primary">
                {formatRupiah(snapshot?.bufferPocket ?? 0)}
              </span>
              {snapshot && (
                <EditableTarget
                  snapshotId={snapshot.id}
                  category="BUFFER"
                  categoryLabel="Emergency Buffer"
                  currentValue={snapshot.bufferPocket}
                  isLocked={isLocked}
                  revisions={snapshot.budgetRevisions}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="border-t border-border-subtle" />

      {/* BOTTOM HALF: LOG OPERATIONAL ACTIVITY */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
              Log Activity
            </span>
            {!isLocked && (
              <kbd
                title="Press 'N' anywhere to focus"
                className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-subtle border border-border-subtle text-text-tertiary"
              >
                N
              </kbd>
            )}
          </div>
          <span className="text-[10px] font-mono text-text-tertiary">
            {expenseMode === "OPERATIONAL"
              ? "Daily living"
              : expenseMode === "FIXED_ESSENTIAL"
                ? "Routine pool"
                : "Refund offset"}
          </span>
        </div>

        {isLocked ? (
          <div className="rounded border border-border-subtle bg-surface-subtle p-3 flex items-center gap-2 text-xs font-sans text-text-tertiary">
            <Lock className="w-3.5 h-3.5 text-text-tertiary" strokeWidth={1.8} />
            <span className="text-[11px]">Period is locked. Writes disabled.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Mode Selector */}
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded bg-surface-subtle border border-border-subtle">
              <button
                type="button"
                onClick={() => setExpenseMode("OPERATIONAL")}
                className={`px-2 py-1 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer ${
                  expenseMode === "OPERATIONAL"
                    ? "bg-surface-active text-text-primary border border-border"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Operational
              </button>
              <button
                type="button"
                onClick={() => setExpenseMode("FIXED_ESSENTIAL")}
                className={`px-2 py-1 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer ${
                  expenseMode === "FIXED_ESSENTIAL"
                    ? "bg-surface-active text-text-primary border border-border"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Routine Bill
              </button>
              <button
                type="button"
                onClick={() => setExpenseMode("OPERATIONAL_REFUND")}
                className={`px-2 py-1 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer ${
                  expenseMode === "OPERATIONAL_REFUND"
                    ? "bg-[rgba(16,183,141,0.12)] text-delta-positive border border-[rgba(16,183,141,0.3)]"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Refund / Split
              </button>
            </div>

            {expenseMode === "FIXED_ESSENTIAL" && (
              <select
                value={fixedEssentialCategory}
                onChange={(e) =>
                  setFixedEssentialCategory(
                    e.target.value as FixedEssentialCategory
                  )
                }
                className="w-full px-2 py-1 rounded bg-surface-subtle border border-border text-[11px] font-sans text-text-primary focus:outline-none focus:border-border-strong"
              >
                {FIXED_ESSENTIAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {expenseMode === "OPERATIONAL_REFUND" && (
              <div className="px-2 py-1 rounded bg-[rgba(16,183,141,0.08)] border border-[rgba(16,183,141,0.25)] text-[10px] font-sans text-text-secondary">
                Restores daily safe-to-spend budget directly without inflating income.
              </div>
            )}

            {/* Quick-tap presets */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-sans text-text-tertiary mr-0.5">
                Tap:
              </span>
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetClick(preset.value)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Inputs: Description and Amount */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-7">
                <input
                  ref={descInputRef}
                  type="text"
                  placeholder={
                    expenseMode === "FIXED_ESSENTIAL"
                      ? "e.g. Pertamax"
                      : expenseMode === "OPERATIONAL_REFUND"
                        ? "e.g. Patungan Makan"
                        : "Description (e.g. Lunch)"
                  }
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (fieldErrors.label) {
                      setFieldErrors((prev) => ({ ...prev, label: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  className={`w-full px-2.5 py-1 rounded bg-surface-subtle border text-xs text-text-primary placeholder:text-text-disabled focus:outline-none font-sans ${
                    fieldErrors.label
                      ? "border-urgency focus:border-urgency"
                      : "border-border focus:border-border-strong"
                  }`}
                />
                {fieldErrors.label && (
                  <div className="text-[9px] font-sans text-delta-negative mt-0.5">
                    {fieldErrors.label}
                  </div>
                )}
              </div>
              <div className="col-span-5">
                <input
                  type="number"
                  placeholder="Rp Amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (fieldErrors.amount) {
                      setFieldErrors((prev) => ({ ...prev, amount: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  className={`w-full px-2.5 py-1 rounded bg-surface-subtle border text-xs font-mono tabular-nums text-text-primary placeholder:text-text-disabled focus:outline-none ${
                    fieldErrors.amount
                      ? "border-urgency focus:border-urgency"
                      : "border-border focus:border-border-strong"
                  }`}
                />
                {fieldErrors.amount && (
                  <div className="text-[9px] font-sans text-delta-negative mt-0.5">
                    {fieldErrors.amount}
                  </div>
                )}
              </div>
            </div>

            {fieldErrors.general && (
              <div className="text-[10px] font-sans text-delta-negative">
                {fieldErrors.general}
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-sans font-medium bg-surface-active hover:bg-surface-hover text-text-primary border border-border hover:border-border-strong transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>Recording...</span>
                ) : isSuccess ? (
                  <>
                    <Check
                      className="w-3.5 h-3.5 text-delta-positive"
                      strokeWidth={1.8}
                    />
                    <span>Recorded</span>
                  </>
                ) : (
                  <>
                    <Plus
                      className="w-3.5 h-3.5 text-text-secondary"
                      strokeWidth={1.8}
                    />
                    <span>
                      {expenseMode === "OPERATIONAL_REFUND"
                        ? "Record Refund"
                        : "Record Expense"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

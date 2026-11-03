"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Lock, Check } from "lucide-react";
import { createIncomeTransaction } from "@/lib/api";

interface QuickIncomeFormProps {
  month: number;
  year: number;
  isLocked: boolean;
}

const PRESET_AMOUNTS = [
  { label: "500k", value: 500000 },
  { label: "1M", value: 1000000 },
  { label: "2.5M", value: 2500000 },
  { label: "5M", value: 5000000 },
];

export function QuickIncomeForm({
  month,
  year,
  isLocked,
}: QuickIncomeFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ label?: string; amount?: string; general?: string }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [, startTransition] = useTransition();

  const handlePresetClick = (presetValue: number) => {
    setAmount(presetValue.toString());
    if (fieldErrors.amount) {
      setFieldErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLocked) return;
    const errors: { label?: string; amount?: string } = {};

    if (!label.trim()) {
      errors.label = "Income description is required";
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
      const res = await createIncomeTransaction({
        month,
        year,
        label: label.trim(),
        amount: numAmount,
        date: new Date().toISOString(),
      });

      if (!res) {
        throw new Error("Failed to record income transaction.");
      }

      setLabel("");
      setAmount("");
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);

      // Refresh server components
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

  if (isLocked) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-xs font-sans text-text-tertiary">
          <Lock className="w-3.5 h-3.5 text-text-tertiary" strokeWidth={1.8} />
          <span className="font-medium text-text-secondary">Windfall Income Recording Disabled</span>
        </div>
        <p className="mt-2 text-xs text-text-tertiary font-sans leading-relaxed">
          This monthly period is <strong className="text-text-secondary">LOCKED</strong>. Additional income transactions cannot be recorded against a finalized snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h2 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
            Log Extra / Windfall Income
          </h2>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            Record consulting, bonus, dividend, or freelance receipts.
          </p>
        </div>
        <span className="text-[11px] font-mono text-delta-positive bg-[rgba(16,183,141,0.08)] px-2 py-0.5 rounded border border-[rgba(16,183,141,0.2)]">
          INCOME
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Preset chips */}
        <div>
          <div className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1.5">
            Quick Amount Presets
          </div>
          <div className="flex items-center gap-2">
            {PRESET_AMOUNTS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePresetClick(p.value)}
                className="px-2.5 py-1 text-xs font-mono rounded bg-surface-subtle hover:bg-surface-active text-text-secondary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
              >
                +{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input fields */}
        <div className="grid grid-cols-1 gap-2.5">
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Description / Source
            </label>
            <input
              type="text"
              placeholder="e.g. Freelance project payment, Dividend"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (fieldErrors.label) {
                  setFieldErrors((prev) => ({ ...prev, label: undefined }));
                }
              }}
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-sans text-text-primary placeholder:text-text-tertiary focus:outline-none ${
                fieldErrors.label
                  ? "border-urgency focus:border-urgency"
                  : "border-border-subtle focus:border-border-active"
              }`}
            />
            {fieldErrors.label && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.label}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Amount (Rp)
            </label>
            <input
              type="number"
              placeholder="e.g. 2500000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (fieldErrors.amount) {
                  setFieldErrors((prev) => ({ ...prev, amount: undefined }));
                }
              }}
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none ${
                fieldErrors.amount
                  ? "border-urgency focus:border-urgency"
                  : "border-border-subtle focus:border-border-active"
              }`}
            />
            {fieldErrors.amount && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.amount}
              </div>
            )}
          </div>
        </div>

        {fieldErrors.general && (
          <div className="text-xs text-delta-negative bg-[rgba(224,108,83,0.08)] border border-[rgba(224,108,83,0.25)] py-1.5 px-2.5 rounded font-sans">
            {fieldErrors.general}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 rounded bg-surface-active hover:bg-border-active text-text-primary text-xs font-sans font-medium border border-border-subtle transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {isSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
              <span className="text-delta-positive">Income Recorded</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
              <span>{isSubmitting ? "Recording..." : "Record Windfall Income"}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

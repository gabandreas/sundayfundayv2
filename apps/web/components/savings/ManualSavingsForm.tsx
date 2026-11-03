"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  createSavingsTransaction,
  SavingsInstrumentType,
  UntransferredLockedPeriod,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface ManualSavingsFormProps {
  untransferredLockedPeriods?: UntransferredLockedPeriod[];
}

export function ManualSavingsForm({
  untransferredLockedPeriods = [],
}: ManualSavingsFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const [type, setType] = useState<"TOPUP" | "WITHDRAWAL">("TOPUP");
  const [instrumentType, setInstrumentType] =
    useState<SavingsInstrumentType>("LIQUID_CASH");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayStr);
  const [attributedPeriod, setAttributedPeriod] = useState<{
    month: number;
    year: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    amount?: string;
    label?: string;
    date?: string;
    general?: string;
  }>({});

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setAmount(raw);
    if (fieldErrors.amount) {
      setFieldErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const errors: { amount?: string; label?: string; date?: string } = {};

    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.amount = "Amount must be greater than Rp 0";
    }

    if (!label.trim()) {
      errors.label = "Remark / description is required";
    }

    if (!date) {
      errors.date = "Valid date is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await createSavingsTransaction({
        type,
        instrumentType,
        amount: numericAmount,
        label: label.trim(),
        date: new Date(date).toISOString(),
        ...(type === "TOPUP" && attributedPeriod
          ? {
              periodMonth: attributedPeriod.month,
              periodYear: attributedPeriod.year,
            }
          : {}),
      });

      if (!res.success) {
        setFieldErrors({ general: res.error || "Failed to record savings transaction" });
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setAmount("");
        setLabel("");
        setDate(todayStr);
        setAttributedPeriod(null);
        setIsOpen(false);
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setFieldErrors({ general: err.message || "An unexpected error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrefillLockedPeriod = (p: UntransferredLockedPeriod) => {
    setIsOpen(true);
    setType("TOPUP");
    setAmount(String(p.untransferredAmount));
    setLabel(p.suggestedLabel);
    setAttributedPeriod({ month: p.month, year: p.year });
    setFieldErrors({});
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Enhancement 3: Retroactive Sweep Pre-fill Bar for Already-Locked Periods */}
      {untransferredLockedPeriods.length > 0 && (
        <div className="px-4 py-3 border-b border-border-subtle bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-sans text-text-secondary">
            <strong className="text-text-primary font-semibold">
              Unrealized Locked Period P1 Savings:
            </strong>{" "}
            Click a closed period below to pre-fill a Vault deposit (never auto-submitted).
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {untransferredLockedPeriods.map((p) => (
              <button
                key={`${p.year}-${p.month}`}
                type="button"
                onClick={() => handlePrefillLockedPeriod(p)}
                className="px-2.5 py-1 rounded border border-[rgba(16,183,141,0.35)] bg-[rgba(16,183,141,0.08)] hover:bg-[rgba(16,183,141,0.15)] text-[11px] font-sans text-delta-positive transition-colors cursor-pointer"
              >
                Pre-fill {p.month}/{p.year} P1 Savings:{" "}
                <strong className="font-mono">
                  {formatRupiah(p.untransferredAmount)}
                </strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isOpen ? (
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold font-sans text-text-primary">
              Manual Vault Adjustment
            </h3>
            <p className="text-xs font-sans text-text-secondary mt-0.5">
              Record a manual liquid deposit or emergency withdrawal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-3 py-1.5 rounded text-xs font-medium font-sans bg-surface-subtle hover:bg-surface-hover border border-border text-text-primary transition-colors cursor-pointer"
          >
            + Log Transaction
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <h3 className="text-sm font-semibold font-sans text-text-primary">
                Record Vault Transaction
              </h3>
              <p className="text-xs font-sans text-text-secondary mt-0.5">
                Vault balances operate independently of monthly snapshot lock cycles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFieldErrors({});
              }}
              className="text-xs font-mono text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {fieldErrors.general && (
            <div className="p-2.5 rounded text-xs font-mono text-delta-negative bg-[rgba(224,108,83,0.10)] border border-[rgba(224,108,83,0.25)]">
              {fieldErrors.general}
            </div>
          )}

          {/* Type & Instrument Toggles */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
                TRANSACTION TYPE
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("TOPUP")}
                  className={`py-2 px-3 rounded text-xs font-medium font-sans border text-center transition-colors cursor-pointer ${
                    type === "TOPUP"
                      ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                      : "bg-surface-subtle border-border-subtle text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Top-Up (Deposit)
                </button>
                <button
                  type="button"
                  onClick={() => setType("WITHDRAWAL")}
                  className={`py-2 px-3 rounded text-xs font-medium font-sans border text-center transition-colors cursor-pointer ${
                    type === "WITHDRAWAL"
                      ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                      : "bg-surface-subtle border-border-subtle text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Withdrawal
                </button>
              </div>
            </div>

            <div className="col-span-6">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
                VAULT SUB-ALLOCATION INSTRUMENT
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInstrumentType("LIQUID_CASH")}
                  className={`py-2 px-3 rounded text-xs font-medium font-sans border text-center transition-colors cursor-pointer ${
                    instrumentType === "LIQUID_CASH"
                      ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                      : "bg-surface-subtle border-border-subtle text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Liquid Emergency Cash
                </button>
                <button
                  type="button"
                  onClick={() => setInstrumentType("INVESTMENT_RDPU")}
                  className={`py-2 px-3 rounded text-xs font-medium font-sans border text-center transition-colors cursor-pointer ${
                    instrumentType === "INVESTMENT_RDPU"
                      ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                      : "bg-surface-subtle border-border-subtle text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Investment — RDPU
                </button>
              </div>
            </div>
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
                AMOUNT (IDR)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={amount ? formatRupiah(parseInt(amount, 10)) : ""}
                  onChange={handleAmountChange}
                  placeholder="Rp 0"
                  className={`w-full px-3 py-2 rounded bg-surface-subtle border text-xs font-mono tabular-nums text-text-primary focus:outline-none ${
                    fieldErrors.amount
                      ? "border-urgency focus:border-urgency"
                      : "border-border focus:border-border-strong"
                  }`}
                />
                {fieldErrors.amount && (
                  <div className="text-[10px] font-sans text-delta-negative mt-1">
                    {fieldErrors.amount}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-4">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
                DATE
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (fieldErrors.date) {
                    setFieldErrors((prev) => ({ ...prev, date: undefined }));
                  }
                }}
                className={`w-full px-3 py-2 rounded bg-surface-subtle border text-xs font-mono text-text-primary focus:outline-none ${
                  fieldErrors.date
                    ? "border-urgency focus:border-urgency"
                    : "border-border focus:border-border-strong"
                }`}
              />
              {fieldErrors.date && (
                <div className="text-[10px] font-sans text-delta-negative mt-1">
                  {fieldErrors.date}
                </div>
              )}
            </div>
          </div>

          {/* Remark / Label */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
              REMARK / DESCRIPTION
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (fieldErrors.label) {
                  setFieldErrors((prev) => ({ ...prev, label: undefined }));
                }
              }}
              placeholder="e.g. Monthly buffer allocation, Emergency medical deposit"
              className={`w-full px-3 py-2 rounded bg-surface-subtle border text-xs font-sans text-text-primary focus:outline-none ${
                fieldErrors.label
                  ? "border-urgency focus:border-urgency"
                  : "border-border focus:border-border-strong"
              }`}
            />
            {fieldErrors.label && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.label}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFieldErrors({});
              }}
              className="px-3 py-1.5 rounded text-xs font-sans text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded text-xs font-medium font-sans bg-text-primary text-surface hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                "Recording..."
              ) : isSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
                  <span className="text-delta-positive">Recorded</span>
                </>
              ) : (
                "Record Transaction"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

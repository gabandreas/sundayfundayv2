"use client";

import React, { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { createCardCharge, CreditLimitCalculationResult } from "@/lib/api";
import {
  DOMAIN_CONSTANTS,
  formatRupiah,
  formatCurrencyInput,
  parseCurrencyInput,
  getJakartaDateParts,
} from "@/lib/utils";

interface AddCardChargeFormProps {
  currentMonth: number;
  currentYear: number;
  statementCutoffDay?: number;
  currentPeriodLimitData?: CreditLimitCalculationResult | null;
}

export function AddCardChargeForm({
  currentMonth,
  currentYear,
  statementCutoffDay = DOMAIN_CONSTANTS.CC_CUTOFF_DAY,
  currentPeriodLimitData = null,
}: AddCardChargeFormProps) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const jktToday = getJakartaDateParts();
  const defaultDateStr =
    jktToday.month === currentMonth && jktToday.year === currentYear
      ? jktToday.isoDate
      : `${currentYear}-${pad(currentMonth)}-10`;

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [chargeType, setChargeType] = useState<"FULL" | "INSTALLMENT" | "RECURRING">("FULL");
  const [tenor, setTenor] = useState("6");
  const [transactionDate, setTransactionDate] = useState(defaultDateStr);
  const [endedAtMonth, setEndedAtMonth] = useState<string>("");
  const [endedAtYear, setEndedAtYear] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ label?: string; amount?: string; general?: string }>({});

  // Parse YYYY-MM-DD directly so UTC offset never shifts the transaction day
  const dateParts = transactionDate.split("-").map(Number);
  const txYear = dateParts.length === 3 && !isNaN(dateParts[0]) ? dateParts[0] : currentYear;
  const txMonth = dateParts.length === 3 && !isNaN(dateParts[1]) ? dateParts[1] : currentMonth;
  const txDay = dateParts.length === 3 && !isNaN(dateParts[2]) ? dateParts[2] : 10;

  let billingMonth = txMonth;
  let billingYear = txYear;
  if (txDay > statementCutoffDay) {
    billingMonth = txMonth === 12 ? 1 : txMonth + 1;
    billingYear = txMonth === 12 ? txYear + 1 : txYear;
  }

  const isCrossPeriod = billingMonth !== currentMonth || billingYear !== currentYear;

  // Live pre-submission limit guardrail when billing into current period
  const typedAmount = parseCurrencyInput(amount);
  const parsedTenor = Math.max(1, parseInt(tenor, 10) || 1);
  const addedMonthlyCcImpact =
    chargeType === "INSTALLMENT"
      ? Math.round(typedAmount / parsedTenor)
      : typedAmount;

  const isTargetCurrentPeriod =
    !isCrossPeriod &&
    currentPeriodLimitData &&
    currentPeriodLimitData.month === billingMonth &&
    currentPeriodLimitData.year === billingYear;

  const projectedCcUsage = isTargetCurrentPeriod
    ? currentPeriodLimitData.ccEvaluation.usage + addedMonthlyCcImpact
    : 0;
  const configuredCcLimit = isTargetCurrentPeriod
    ? currentPeriodLimitData.ccEvaluation.limit
    : 0;
  const safeCcHeadroom = isTargetCurrentPeriod
    ? currentPeriodLimitData.ceilingBreakdown.remainingSafeHeadroomForCc
    : 0;

  const willBreachConfiguredCcLimit =
    isTargetCurrentPeriod &&
    typedAmount > 0 &&
    configuredCcLimit > 0 &&
    projectedCcUsage > configuredCcLimit;

  const willBreachSafeCcHeadroom =
    isTargetCurrentPeriod &&
    typedAmount > 0 &&
    projectedCcUsage > safeCcHeadroom;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const errors: { label?: string; amount?: string } = {};

    if (!label.trim()) {
      errors.label = "Description / merchant is required";
    }

    const numericAmount = parseCurrencyInput(amount);
    if (numericAmount <= 0) {
      errors.amount = "Amount must be greater than Rp 0";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const res = await createCardCharge({
      label: label.trim(),
      amount: numericAmount,
      chargeType,
      category,
      transactionDate,
      isRecurring: chargeType === "RECURRING",
      tenor: chargeType === "INSTALLMENT" ? parseInt(tenor, 10) : undefined,
      endedAtMonth:
        chargeType === "RECURRING" && endedAtMonth && endedAtYear
          ? parseInt(endedAtMonth, 10)
          : undefined,
      endedAtYear:
        chargeType === "RECURRING" && endedAtMonth && endedAtYear
          ? parseInt(endedAtYear, 10)
          : undefined,
      notes: notes.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setIsSuccess(true);
      setLabel("");
      setAmount("");
      setEndedAtMonth("");
      setEndedAtYear("");
      setNotes("");
      setTimeout(() => setIsSuccess(false), 2000);
    } else {
      setFieldErrors({ general: res.error || "Failed to create card charge" });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold font-sans text-text-primary">
          Record New Card Charge
        </h3>
        <p className="text-xs font-sans text-text-secondary mt-0.5">
          Charges are matched into statement cycles by transaction date and statement cutoff.
        </p>
      </div>

      {fieldErrors.general && (
        <div className="p-3 bg-urgency/10 border border-urgency/30 rounded text-xs font-sans text-urgency">
          {fieldErrors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Label / Description */}
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
              Description / Merchant
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
              placeholder="e.g. Uniqlo Grand Indonesia"
              className={`w-full bg-surface-subtle border rounded px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
                fieldErrors.label
                  ? "border-urgency focus:border-urgency"
                  : "border-border focus:border-accent"
              }`}
            />
            {fieldErrors.label && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.label}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
              Amount (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(formatCurrencyInput(e.target.value));
                if (fieldErrors.amount) {
                  setFieldErrors((prev) => ({ ...prev, amount: undefined }));
                }
              }}
              placeholder="850.000"
              className={`w-full bg-surface-subtle border rounded px-3 py-2 text-xs font-mono text-text-primary text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 tabular-nums ${
                fieldErrors.amount
                  ? "border-urgency focus:border-urgency"
                  : "border-border focus:border-accent"
              }`}
            />
            {fieldErrors.amount && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.amount}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Charge Type */}
          <div className="sm:col-span-1 lg:col-span-4">
            <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
              Charge Type
            </label>
            <select
              value={chargeType}
              onChange={(e) => setChargeType(e.target.value as any)}
              className="w-full bg-surface-subtle border border-border rounded px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent"
            >
              <option value="FULL">Full payment</option>
              <option value="INSTALLMENT">Installment (0%)</option>
              <option value="RECURRING">Recurring Subscription</option>
            </select>
          </div>

          {/* If Installment: Tenor */}
          {chargeType === "INSTALLMENT" && (
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
                Tenor (months)
              </label>
              <select
                value={tenor}
                onChange={(e) => setTenor(e.target.value)}
                className="w-full bg-surface-subtle border border-border rounded px-3 py-2 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent"
              >
                <option value="3">3 mo</option>
                <option value="6">6 mo</option>
                <option value="12">12 mo</option>
                <option value="24">24 mo</option>
              </select>
            </div>
          )}

          {/* Category */}
          <div className={chargeType === "INSTALLMENT" ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-1 lg:col-span-4"}>
            <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
              CATEGORY
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-subtle border border-border rounded px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent"
            >
              <option value="Shopping">Shopping</option>
              <option value="Electronics">Electronics</option>
              <option value="Subscription">Subscription</option>
              <option value="Dining">Dining</option>
              <option value="Travel">Travel</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Transaction Date */}
          <div className={chargeType === "INSTALLMENT" ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-2 lg:col-span-4"}>
            <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
              Transaction Date
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="w-full bg-surface-subtle border border-border rounded px-3 py-2 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent"
            />
          </div>
        </div>

        {/* Target Billing Period info note */}
        <div className="p-3 bg-surface-subtle border border-border-subtle rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-sans">
          <span className="text-text-tertiary">
            Billing Target:{" "}
            <strong className="font-mono text-text-primary">
              {billingMonth}/{billingYear}
            </strong>{" "}
            (statement cutoff day {statementCutoffDay})
          </span>
          {isCrossPeriod && (
            <span className="px-1.5 py-0.5 rounded border border-[rgba(229,155,44,0.3)] text-caution bg-[rgba(229,155,44,0.08)] text-[10px] font-mono">
              Billed into next period (Date &gt; {statementCutoffDay})
            </span>
          )}
        </div>

        {/* Live Pre-Submission Limit Guardrail */}
        {(willBreachConfiguredCcLimit || willBreachSafeCcHeadroom) && (
          <div className="p-3 rounded border border-[rgba(224,108,83,0.35)] bg-[rgba(224,108,83,0.08)] flex items-start gap-2 text-xs font-sans text-text-primary">
            <AlertTriangle
              className="w-4 h-4 text-delta-negative shrink-0 mt-0.5"
              strokeWidth={1.8}
            />
            <div className="space-y-0.5">
              {willBreachConfiguredCcLimit && (
                <div>
                  <strong className="text-delta-negative">
                    Exceeds Configured CC Cap:
                  </strong>{" "}
                  Adding{" "}
                  <span className="font-mono">
                    {formatRupiah(addedMonthlyCcImpact)}
                  </span>{" "}
                  brings {billingMonth}/{billingYear} Credit Card usage to{" "}
                  <span className="font-mono font-semibold text-delta-negative">
                    {formatRupiah(projectedCcUsage)}
                  </span>{" "}
                  (cap: <span className="font-mono">{formatRupiah(configuredCcLimit)}</span>).
                </div>
              )}
              {willBreachSafeCcHeadroom && (
                <div className="text-text-secondary">
                  Projected CC usage (<span className="font-mono">{formatRupiah(projectedCcUsage)}</span>) exceeds the remaining Deficit-Safe CC Headroom (<span className="font-mono">{formatRupiah(safeCcHeadroom)}</span>) for {billingMonth}/{billingYear}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Optional End Period for RECURRING subscriptions */}
        {chargeType === "RECURRING" && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-3 rounded bg-surface-subtle border border-border-subtle">
            <div className="sm:col-span-6">
              <div className="text-xs font-medium font-sans text-text-primary">
                Optional Effective End Period
              </div>
              <p className="text-[11px] font-sans text-text-tertiary mt-0.5">
                Leave blank if subscription is ongoing indefinitely. If set, billing stops after the selected month/year.
              </p>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                End Month (1-12)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={endedAtMonth}
                onChange={(e) => setEndedAtMonth(e.target.value)}
                placeholder="e.g. 12"
                className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                End Year
              </label>
              <input
                type="number"
                min={2026}
                max={2035}
                value={endedAtYear}
                onChange={(e) => setEndedAtYear(e.target.value)}
                placeholder="e.g. 2026"
                className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary"
              />
            </div>
          </div>
        )}

        {/* Notes (optional) */}
        <div>
          <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Promo diskon 10%, cicilan BCA 0%"
            className="w-full bg-surface-subtle border border-border rounded px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-text-primary text-surface font-sans font-medium text-xs rounded hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              "Recording Charge..."
            ) : isSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
                <span className="text-delta-positive">Recorded</span>
              </>
            ) : (
              "Add Card Charge"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

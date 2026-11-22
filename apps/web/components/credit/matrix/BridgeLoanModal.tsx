"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { LiabilityMatrixColumn, createBridgeLoan } from "@/lib/api";
import { formatRupiah, formatCurrencyInput, parseCurrencyInput } from "@/lib/utils";

interface BridgeLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: LiabilityMatrixColumn[];
  currentMonth: number;
  currentYear: number;
}

export function BridgeLoanModal({
  isOpen,
  onClose,
  columns,
  currentMonth,
  currentYear,
}: BridgeLoanModalProps) {

  const currentIdx = Math.max(
    0,
    columns.findIndex((c) => c.month === currentMonth && c.year === currentYear)
  );
  const nextCol = columns[currentIdx + 1] ?? columns[currentIdx];
  const monthAfterCol = columns[currentIdx + 2] ?? nextCol;

  const [title, setTitle] = useState("SPinjam Bridge Loan");
  const [merchant, setMerchant] = useState("SPinjam");
  const [principalRaw, setPrincipalRaw] = useState("900.000");
  const [monthlyRaw, setMonthlyRaw] = useState("335.578");
  const [tenorMonths, setTenorMonths] = useState(3);

  const [inflowKey, setInflowKey] = useState(columns[currentIdx]?.key ?? "");
  const [livingRaw, setLivingRaw] = useState("700.000");
  const [routineRaw, setRoutineRaw] = useState("200.000");
  const [routineSlot, setRoutineSlot] = useState<"TRANSPORT" | "INTERNET" | "VAPE" | "HAIRCUT">(
    "INTERNET"
  );
  const [routineSlotLabel, setRoutineSlotLabel] = useState("");

  const [firstInstallmentKey, setFirstInstallmentKey] = useState(nextCol?.key ?? "");
  const [enableEarlyPayoff, setEnableEarlyPayoff] = useState(false);
  const [earlyPayoffKey, setEarlyPayoffKey] = useState(monthAfterCol?.key ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const principal = parseCurrencyInput(principalRaw);
  const monthlyInstallment = parseCurrencyInput(monthlyRaw);
  const livingAllocation = parseCurrencyInput(livingRaw);
  const routineAllocation = parseCurrencyInput(routineRaw);
  const totalAllocated = livingAllocation + routineAllocation;

  const findCol = (key: string) =>
    columns.find((c) => c.key === key) ?? { month: currentMonth, year: currentYear };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || principal <= 0 || monthlyInstallment <= 0) {
      setErrorMsg("Enter loan label, disbursed principal, and monthly installment.");
      return;
    }
    if (totalAllocated > principal) {
      setErrorMsg("Living Cash + Routine Bills allocation cannot exceed disbursed principal.");
      return;
    }

    const inflowCol = findCol(inflowKey);
    const firstInstCol = findCol(firstInstallmentKey);
    const payoffCol = enableEarlyPayoff ? findCol(earlyPayoffKey) : null;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createBridgeLoan({
      title: title.trim(),
      merchantOrPlatform: merchant.trim() || "SPinjam",
      principalAmount: principal,
      monthlyInstallment,
      tenorMonths,
      inflowMonth: inflowCol.month,
      inflowYear: inflowCol.year,
      livingCashAllocation: livingAllocation,
      routineBillsAllocation: routineAllocation,
      routineCategorySlot: routineAllocation > 0 ? routineSlot : undefined,
      routineSlotLabel: routineSlotLabel.trim() || undefined,
      firstInstallmentMonth: firstInstCol.month,
      firstInstallmentYear: firstInstCol.year,
      earlyPayoffMonth: payoffCol?.month,
      earlyPayoffYear: payoffCol?.year,
      dueDay: 8,
    });

    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to record bridge loan.");
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65" onClick={onClose}>
      <div
        className="w-full sm:w-[560px] max-w-full max-h-[92vh] overflow-y-auto rounded-lg border border-border bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold font-sans text-text-primary">
              Record Bridge Loan & Cash Injection
            </h3>
            <p className="text-xs font-sans text-text-secondary mt-0.5">
              Injects liquidity into the active period while scheduling repayments on the Matrix.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded border border-border-subtle text-text-tertiary hover:text-text-primary"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded erp-callout-urgency text-xs font-sans text-urgency">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-tertiary">
                Loan Description
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-tertiary">
                Platform / Lender
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-tertiary">
                Principal Disbursed
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={principalRaw}
                onChange={(e) => setPrincipalRaw(formatCurrencyInput(e.target.value))}
                className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-tertiary">
                Monthly Installment
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={monthlyRaw}
                onChange={(e) => setMonthlyRaw(formatCurrencyInput(e.target.value))}
                className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-tertiary">
                Tenor (Months)
              </label>
              <input
                type="number"
                min={1}
                max={36}
                value={tenorMonths}
                onChange={(e) => setTenorMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary"
              />
            </div>
          </div>

          {/* Cash Inflow Split */}
          <div className="p-3 rounded border border-border-subtle bg-surface-subtle space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-[10px] font-mono uppercase text-text-tertiary">
                Cash Inflow Split
              </span>
              <span className="text-[11px] font-mono tabular-nums text-text-secondary">
                Allocated: {formatRupiah(totalAllocated, false)} / {formatRupiah(principal, false)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-tertiary">Inflow Period</label>
                <select
                  value={inflowKey}
                  onChange={(e) => setInflowKey(e.target.value)}
                  className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary"
                >
                  {columns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-tertiary">Living Cash</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={livingRaw}
                  onChange={(e) => setLivingRaw(formatCurrencyInput(e.target.value))}
                  className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs font-mono tabular-nums text-text-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-tertiary">Routine Bills</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={routineRaw}
                  onChange={(e) => setRoutineRaw(formatCurrencyInput(e.target.value))}
                  className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs font-mono tabular-nums text-text-primary"
                />
              </div>
            </div>

            {routineAllocation > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary">Routine Slot</label>
                  <select
                    value={routineSlot}
                    onChange={(e) => setRoutineSlot(e.target.value as any)}
                    className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary"
                  >
                    <option value="INTERNET">Internet / Slot 2</option>
                    <option value="TRANSPORT">Transport / Slot 1</option>
                    <option value="VAPE">Vape / Slot 3</option>
                    <option value="HAIRCUT">Haircut / Slot 4</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary">
                    One-Off Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={routineSlotLabel}
                    onChange={(e) => setRoutineSlotLabel(e.target.value)}
                    placeholder="e.g. Nov 25 Bill"
                    className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs font-sans text-text-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Repayment Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-tertiary">
                1st Installment Period
              </label>
              <select
                value={firstInstallmentKey}
                onChange={(e) => setFirstInstallmentKey(e.target.value)}
                className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary"
              >
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.paysDueMonth})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-sans text-text-secondary cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={enableEarlyPayoff}
                  onChange={(e) => setEnableEarlyPayoff(e.target.checked)}
                />
                Consolidate remaining balance early in:
              </label>
              {enableEarlyPayoff && (
                <select
                  value={earlyPayoffKey}
                  onChange={(e) => setEarlyPayoffKey(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary"
                >
                  {columns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border border-border text-xs font-sans text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-text-primary text-canvas text-xs font-sans font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Recording..." : "Create Bridge Loan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { updateSnapshot } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface PayrollAdjustmentFormProps {
  snapshotId: number;
  month: number;
  year: number;
  isLocked: boolean;
  initialWorkingDays: number;
  initialSalaryAdjustment: number;
  initialCafeteriaDeduction: number;
  initialBonusAmount: number;
  hasThr: boolean;
  initialThrAmount?: number;
  baseSalary?: number;
  initialPayrollPayoutDate?: string | null;
}

type ThrMode = "NO_THR" | "PRORATED" | "FULL_THR" | "CUSTOM";

export function PayrollAdjustmentForm({
  snapshotId,
  month,
  year,
  isLocked,
  initialWorkingDays,
  initialSalaryAdjustment,
  initialCafeteriaDeduction,
  initialBonusAmount,
  hasThr,
  initialThrAmount = 0,
  baseSalary = 5300000,
  initialPayrollPayoutDate,
}: PayrollAdjustmentFormProps) {
  const router = useRouter();

  const [totalWorkingDays, setTotalWorkingDays] = useState(initialWorkingDays.toString());
  const [salaryAdjustment, setSalaryAdjustment] = useState(initialSalaryAdjustment.toString());
  const [cafeteriaDeduction, setCafeteriaDeduction] = useState(initialCafeteriaDeduction.toString());
  const [bonusAmount, setBonusAmount] = useState(initialBonusAmount.toString());

  // Detect initial THR mode
  const getInitialThrMode = (): ThrMode => {
    if (initialThrAmount > 0) {
      if (month === 12 && Math.abs(initialThrAmount - 3899917) < 100) {
        return "PRORATED";
      }
      if (Math.abs(initialThrAmount - baseSalary) < 100) {
        return "FULL_THR";
      }
      return "CUSTOM";
    }
    if (hasThr) {
      return "PRORATED";
    }
    return "NO_THR";
  };

  const [thrMode, setThrMode] = useState<ThrMode>(getInitialThrMode());
  const [tenureMonths, setTenureMonths] = useState<string>(month === 12 ? "8.83" : "8");
  const [customThrAmount, setCustomThrAmount] = useState<string>(
    initialThrAmount > 0 ? initialThrAmount.toString() : ""
  );

  const [payrollPayoutDate, setPayrollPayoutDate] = useState(
    initialPayrollPayoutDate ? initialPayrollPayoutDate.slice(0, 10) : ""
  );

  useEffect(() => {
    setTotalWorkingDays(initialWorkingDays.toString());
    setSalaryAdjustment(initialSalaryAdjustment.toString());
    setCafeteriaDeduction(initialCafeteriaDeduction.toString());
    setBonusAmount(initialBonusAmount.toString());
    setPayrollPayoutDate(
      initialPayrollPayoutDate ? initialPayrollPayoutDate.slice(0, 10) : ""
    );
    setThrMode(getInitialThrMode());
    if (initialThrAmount > 0) {
      setCustomThrAmount(initialThrAmount.toString());
    }
    setFieldErrors({});
    setIsSuccess(false);
  }, [
    snapshotId,
    month,
    year,
    initialWorkingDays,
    initialSalaryAdjustment,
    initialCafeteriaDeduction,
    initialBonusAmount,
    hasThr,
    initialThrAmount,
    baseSalary,
    initialPayrollPayoutDate,
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    workingDays?: string;
    cafeteria?: string;
    bonus?: string;
    thr?: string;
    general?: string;
  }>({});

  const isDecember = month === 12;
  const numAdjustment = parseFloat(salaryAdjustment) || 0;
  const effectiveBase = baseSalary + numAdjustment;

  // Compute live effective THR amount based on selected mode
  const getComputedThrAmount = (): number => {
    switch (thrMode) {
      case "NO_THR":
        return 0;
      case "PRORATED": {
        const tenure = parseFloat(tenureMonths) || 0;
        return Math.round((tenure / 12) * effectiveBase);
      }
      case "FULL_THR":
        return effectiveBase;
      case "CUSTOM":
        return parseInt(customThrAmount, 10) || 0;
    }
  };

  const effectiveThrAmount = getComputedThrAmount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isSubmitting) return;

    const errors: {
      workingDays?: string;
      cafeteria?: string;
      bonus?: string;
      thr?: string;
      general?: string;
    } = {};

    const workingDaysNum = parseInt(totalWorkingDays, 10);
    const cafeteriaNum = parseFloat(cafeteriaDeduction);
    const bonusNum = parseFloat(bonusAmount);

    if (isNaN(workingDaysNum) || workingDaysNum < 0 || workingDaysNum > 31) {
      errors.workingDays = "Working days must be between 0 and 31";
    }
    if (!isNaN(cafeteriaNum) && cafeteriaNum < 0) {
      errors.cafeteria = "Deduction cannot be negative";
    }
    if (!isNaN(bonusNum) && bonusNum < 0) {
      errors.bonus = "Bonus cannot be negative";
    }
    if (thrMode === "PRORATED") {
      const tenure = parseFloat(tenureMonths);
      if (isNaN(tenure) || tenure < 0 || tenure > 12) {
        errors.thr = "Tenure must be between 0 and 12 months";
      }
    } else if (thrMode === "CUSTOM") {
      const customNum = parseInt(customThrAmount, 10);
      if (isNaN(customNum) || customNum < 0) {
        errors.thr = "Custom THR must be greater than or equal to Rp 0";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const payload: {
      totalWorkingDays?: number;
      salaryAdjustment?: number;
      cafeteriaDeduction?: number;
      bonusAmount?: number;
      thrAmount?: number;
      useDecemberProratedThr?: boolean;
      payrollPayoutDate?: string;
    } = {
      totalWorkingDays: isNaN(workingDaysNum) ? 0 : workingDaysNum,
      salaryAdjustment: isNaN(numAdjustment) ? 0 : numAdjustment,
      cafeteriaDeduction: isNaN(cafeteriaNum) ? 0 : cafeteriaNum,
      bonusAmount: isNaN(bonusNum) ? 0 : bonusNum,
      thrAmount: effectiveThrAmount,
      useDecemberProratedThr: isDecember && thrMode === "PRORATED",
    };

    if (payrollPayoutDate) {
      payload.payrollPayoutDate = new Date(payrollPayoutDate).toISOString();
    }

    try {
      const res = await updateSnapshot(snapshotId, payload);
      if (res) {
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 2000);
        router.refresh();
      } else {
        setFieldErrors({ general: "Failed to update payroll parameters." });
      }
    } catch {
      setFieldErrors({ general: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
      <div className="pb-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
          Snapshot Parameters
        </h2>
        <p className="text-xs font-sans text-text-tertiary mt-0.5">
          {isLocked
            ? "Period is locked. All adjustment fields are strictly read-only."
            : "Adjustable monthly inputs. Saves atomically and triggers recalculations."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Total Working Days */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Working Days (Attended)
            </label>
            <input
              type="number"
              min="0"
              max="31"
              value={totalWorkingDays}
              onChange={(e) => {
                setTotalWorkingDays(e.target.value);
                if (fieldErrors.workingDays) {
                  setFieldErrors((prev) => ({ ...prev, workingDays: undefined }));
                }
              }}
              disabled={isLocked || isSubmitting}
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                fieldErrors.workingDays
                  ? "border-urgency focus:border-urgency"
                  : "border-border-subtle focus:border-border-active"
              }`}
            />
            {fieldErrors.workingDays && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.workingDays}
              </div>
            )}
          </div>

          {/* Salary Adjustment */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Salary Adjustment (Rp)
            </label>
            <input
              type="number"
              step="1000"
              value={salaryAdjustment}
              onChange={(e) => setSalaryAdjustment(e.target.value)}
              disabled={isLocked || isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Cafeteria Deduction */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Cafeteria Deduction (Rp)
            </label>
            <input
              id="cafeteria-input"
              type="number"
              min="0"
              step="1000"
              value={cafeteriaDeduction}
              onChange={(e) => {
                setCafeteriaDeduction(e.target.value);
                if (fieldErrors.cafeteria) {
                  setFieldErrors((prev) => ({ ...prev, cafeteria: undefined }));
                }
              }}
              disabled={isLocked || isSubmitting}
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                fieldErrors.cafeteria
                  ? "border-urgency focus:border-urgency"
                  : "border-border-subtle focus:border-border-active"
              }`}
            />
            {fieldErrors.cafeteria && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.cafeteria}
              </div>
            )}
          </div>

          {/* Bonus Amount */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Bonus / Incentive (Rp)
            </label>
            <input
              type="number"
              min="0"
              step="10000"
              value={bonusAmount}
              onChange={(e) => {
                setBonusAmount(e.target.value);
                if (fieldErrors.bonus) {
                  setFieldErrors((prev) => ({ ...prev, bonus: undefined }));
                }
              }}
              disabled={isLocked || isSubmitting}
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                fieldErrors.bonus
                  ? "border-urgency focus:border-urgency"
                  : "border-border-subtle focus:border-border-active"
              }`}
            />
            {fieldErrors.bonus && (
              <div className="text-[10px] font-sans text-delta-negative mt-1">
                {fieldErrors.bonus}
              </div>
            )}
          </div>

          {/* Actual Payroll Payout Date */}
          <div className="col-span-2">
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Actual Payroll Payout Date
            </label>
            <input
              type="date"
              value={payrollPayoutDate}
              onChange={(e) => setPayrollPayoutDate(e.target.value)}
              disabled={isLocked || isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] font-sans text-text-tertiary mt-1">
              Defines the start of this period&apos;s consumption cycle. Does not alter waterfall allocations.
            </p>
          </div>
        </div>

        {/* THR ENGINE: MODE SELECTOR & CONFIGURATION */}
        <div className="p-3.5 rounded border border-border-subtle bg-surface-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-sans font-medium text-text-primary block">
                THR (Tunjangan Hari Raya) Engine
              </span>
              <span className="text-[11px] font-sans text-text-tertiary">
                Annual holiday allowance calculation mode
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-text-primary tabular-nums">
              {formatRupiah(effectiveThrAmount)}
            </span>
          </div>

          {/* Mode Selector Buttons */}
          <div className="grid grid-cols-4 gap-1 p-0.5 rounded bg-surface border border-border-subtle">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => setThrMode("NO_THR")}
              className={`px-2 py-1.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                thrMode === "NO_THR"
                  ? "bg-surface-active text-text-primary border border-border"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              No THR (Rp 0)
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => setThrMode("PRORATED")}
              className={`px-2 py-1.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                thrMode === "PRORATED"
                  ? "bg-surface-active text-text-primary border border-border"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Prorated
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => setThrMode("FULL_THR")}
              className={`px-2 py-1.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                thrMode === "FULL_THR"
                  ? "bg-surface-active text-text-primary border border-border"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Full (100%)
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => setThrMode("CUSTOM")}
              className={`px-2 py-1.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                thrMode === "CUSTOM"
                  ? "bg-surface-active text-text-primary border border-border"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Custom
            </button>
          </div>

          {/* Mode Specific Inputs */}
          {thrMode === "PRORATED" && (
            <div className="pt-2 border-t border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-text-secondary">Worked Tenure (Months / 12):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="12"
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    disabled={isLocked || isSubmitting}
                    className="w-16 px-2 py-1 rounded bg-surface border border-border text-xs font-mono tabular-nums text-text-primary text-center focus:outline-none"
                  />
                  <span className="text-text-tertiary font-mono">/ 12</span>
                </div>
              </div>
              <p className="text-[10px] font-sans text-text-tertiary">
                Formula: Math.round(({tenureMonths || 0} / 12) × {formatRupiah(effectiveBase)}) ={" "}
                <strong className="font-mono text-text-secondary">{formatRupiah(effectiveThrAmount)}</strong>
              </p>
            </div>
          )}

          {thrMode === "FULL_THR" && (
            <div className="pt-2 border-t border-border-subtle">
              <p className="text-[11px] font-sans text-text-secondary">
                Auto-fills 100% of base salary ({formatRupiah(effectiveBase)}).
              </p>
            </div>
          )}

          {thrMode === "CUSTOM" && (
            <div className="pt-2 border-t border-border-subtle space-y-1.5">
              <label className="block text-[11px] font-sans font-medium text-text-secondary">
                Custom Manual THR Amount (Rp)
              </label>
              <input
                type="number"
                step="10000"
                min="0"
                value={customThrAmount}
                onChange={(e) => setCustomThrAmount(e.target.value)}
                disabled={isLocked || isSubmitting}
                placeholder="e.g. 5000000"
                className="w-full px-2.5 py-1.5 rounded bg-surface border border-border text-xs font-mono tabular-nums text-text-primary focus:outline-none"
              />
            </div>
          )}

          {fieldErrors.thr && (
            <div className="text-[10px] font-sans text-delta-negative">
              {fieldErrors.thr}
            </div>
          )}
        </div>

        {/* General Error Message */}
        {fieldErrors.general && (
          <div className="text-xs font-sans py-2 px-3 rounded border bg-[rgba(224,108,83,0.08)] border-[rgba(224,108,83,0.25)] text-delta-negative">
            {fieldErrors.general}
          </div>
        )}

        {/* Save Button */}
        {!isLocked && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 rounded bg-surface-active hover:bg-border-active text-text-primary text-xs font-sans font-medium border border-border-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              "Saving Parameters..."
            ) : isSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
                <span className="text-delta-positive">Saved</span>
              </>
            ) : (
              "Save Parameters"
            )}
          </button>
        )}
      </form>
    </div>
  );
}

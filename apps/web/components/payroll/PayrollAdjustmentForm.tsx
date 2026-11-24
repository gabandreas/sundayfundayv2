"use client";

import { useState, useEffect } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  PayrollAdjustmentStage,
  PayrollAdjustmentTemplateDto,
  PayrollPeriodAdjustmentDto,
  ThrConfig,
  addSnapshotPayrollAdjustmentApi,
  deleteSnapshotPayrollAdjustmentApi,
  updateSnapshot,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { ErpDatePicker } from "@/components/primitives/ErpDatePicker";
import { useToast } from "@/context/ToastContext";

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
  thrConfig?: ThrConfig | null;
  templates?: PayrollAdjustmentTemplateDto[];
  periodAdjustments?: PayrollPeriodAdjustmentDto[];
  onAdjusted?: () => void;
}

type ThrMode = "NO_THR" | "PRORATED" | "FULL_THR" | "CUSTOM";

const STAGE_BADGE_LABELS: Record<PayrollAdjustmentStage, string> = {
  POST_NET_DEDUCTION: "Direct Deduction (Post-Net)",
  PRE_NET_DEDUCTION: "Pre-Net Deduction",
  PRE_NET_EARNING: "Pre-Net Earning",
};

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
  thrConfig,
  templates = [],
  periodAdjustments = [],
  onAdjusted,
}: PayrollAdjustmentFormProps) {
  const { toast } = useToast();
  const [totalWorkingDays, setTotalWorkingDays] = useState(initialWorkingDays.toString());
  const [salaryAdjustment, setSalaryAdjustment] = useState(initialSalaryAdjustment.toString());
  const [cafeteriaDeduction, setCafeteriaDeduction] = useState(initialCafeteriaDeduction.toString());
  const [bonusAmount, setBonusAmount] = useState(initialBonusAmount.toString());

  const thrEnabledInConfig = thrConfig?.enabled ?? true;
  const thrPayoutMonth = thrConfig?.payoutMonth ?? 12;

  const getInitialThrMode = (): ThrMode => {
    if (initialThrAmount > 0) {
      if (Math.abs(initialThrAmount - baseSalary) < 100) {
        return "FULL_THR";
      }
      if (month === thrPayoutMonth && thrEnabledInConfig) {
        return "PRORATED";
      }
      return "CUSTOM";
    }
    if (hasThr) {
      return "PRORATED";
    }
    return "NO_THR";
  };

  const [thrMode, setThrMode] = useState<ThrMode>(getInitialThrMode());
  const [tenureMonths, setTenureMonths] = useState<string>(
    initialThrAmount > 0 && baseSalary > 0
      ? String(Math.round((initialThrAmount / baseSalary) * 12 * 100) / 100)
      : "12",
  );
  const [customThrAmount, setCustomThrAmount] = useState<string>(
    initialThrAmount > 0 ? initialThrAmount.toString() : ""
  );
  const [showThrControls, setShowThrControls] = useState<boolean>(
    thrEnabledInConfig && (month === thrPayoutMonth || hasThr || initialThrAmount > 0),
  );

  // Per-period custom adjustments & direct payroll deductions
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [adjStage, setAdjStage] = useState<PayrollAdjustmentStage>("POST_NET_DEDUCTION");
  const [adjLabel, setAdjLabel] = useState<string>("");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjNotes, setAdjNotes] = useState<string>("");
  const [isMutatingAdj, setIsMutatingAdj] = useState<boolean>(false);

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
        toast({
          title: "Payroll Updated",
          description: `Saved parameters for ${month}/${year}.`,
          variant: "success",
        });
        onAdjusted?.();
        setTimeout(() => setIsSuccess(false), 2000);
      } else {
        setFieldErrors({ general: "Failed to update payroll parameters." });
      }
    } catch {
      setFieldErrors({ general: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTemplate = (templateIdStr: string) => {
    setSelectedTemplateId(templateIdStr);
    const tpl = templates.find((t) => String(t.id) === templateIdStr);
    if (!tpl) return;
    setAdjStage(tpl.stage);
    setAdjLabel(tpl.label);
    const computedAmt =
      tpl.calcType === "PERCENT_OF_BASE"
        ? Math.round((effectiveBase * tpl.defaultAmount) / 100)
        : tpl.calcType === "PER_WORKING_DAY"
          ? Math.round((parseInt(totalWorkingDays, 10) || 0) * tpl.defaultAmount)
          : Math.round(tpl.defaultAmount);
    setAdjAmount(computedAmt > 0 ? String(computedAmt) : "");
    setAdjNotes(tpl.notes ?? "");
  };

  const handleAddAdjustment = async () => {
    if (isLocked || isMutatingAdj) return;
    const numericAmt = Math.round(Number(adjAmount) || 0);
    if (!adjLabel.trim() || numericAmt <= 0) {
      toast({
        title: "Invalid Adjustment",
        description: "Enter a label and an amount greater than Rp 0.",
        variant: "error",
      });
      return;
    }
    setIsMutatingAdj(true);
    const res = await addSnapshotPayrollAdjustmentApi(snapshotId, {
      templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
      label: adjLabel.trim(),
      stage: adjStage,
      amount: numericAmt,
      notes: adjNotes.trim() || undefined,
    });
    setIsMutatingAdj(false);
    if (res.success) {
      setSelectedTemplateId("");
      setAdjLabel("");
      setAdjAmount("");
      setAdjNotes("");
      toast({
        title: "Payroll Deduction Recorded",
        description: `Added "${adjLabel.trim()}" (${formatRupiah(numericAmt)}) to ${month}/${year}.`,
        variant: "success",
      });
      onAdjusted?.();
    } else {
      toast({
        title: "Failed to Add Item",
        description: res.error || "Unable to save payroll adjustment.",
        variant: "error",
      });
    }
  };

  const handleDeleteAdjustment = async (adjId: number, label: string) => {
    if (isLocked || isMutatingAdj) return;
    setIsMutatingAdj(true);
    const res = await deleteSnapshotPayrollAdjustmentApi(snapshotId, adjId);
    setIsMutatingAdj(false);
    if (res.success) {
      toast({
        title: "Adjustment Removed",
        description: `Removed "${label}" from ${month}/${year}.`,
        variant: "info",
      });
      onAdjusted?.();
    } else {
      toast({
        title: "Delete Failed",
        description: res.error || "Unable to delete payroll adjustment.",
        variant: "error",
      });
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
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 disabled:cursor-not-allowed ${
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
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-active disabled:opacity-50 disabled:cursor-not-allowed"
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
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 disabled:cursor-not-allowed ${
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
              className={`w-full bg-surface-subtle border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 disabled:cursor-not-allowed ${
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
            <ErpDatePicker
              value={payrollPayoutDate}
              onChange={setPayrollPayoutDate}
              disabled={isLocked || isSubmitting}
              ariaLabel="Actual Payroll Payout Date"
            />
            <p className="text-[10px] font-sans text-text-tertiary mt-1">
              Defines the start of this period&apos;s consumption cycle. Does not alter waterfall allocations.
            </p>
          </div>
        </div>

        {/* THR / HOLIDAY BONUS SECTION (CONDITIONAL) */}
        {!showThrControls ? (
          <div className="flex items-center justify-between px-3 py-2 rounded border border-border-subtle bg-surface-subtle text-xs">
            <span className="text-text-tertiary">
              {thrEnabledInConfig
                ? `${thrConfig?.label || "Holiday Bonus (THR)"} is inactive for month ${month}.`
                : "Holiday Bonus (THR) is disabled in Preferences."}
            </span>
            {thrEnabledInConfig && !isLocked && (
              <button
                type="button"
                onClick={() => setShowThrControls(true)}
                className="font-mono text-[11px] text-accent hover:underline cursor-pointer"
              >
                Adjust {thrConfig?.label || "THR"}
              </button>
            )}
          </div>
        ) : (
        <div className="p-3.5 rounded border border-border-subtle bg-surface-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-sans font-medium text-text-primary block">
                {thrConfig?.label || "Holiday Bonus (THR)"}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary">
                Seasonal allowance calculation mode
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
                    className="w-20 px-2 py-1 rounded bg-surface border border-border text-xs font-mono tabular-nums text-text-primary text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                  />
                  <span className="text-text-tertiary font-mono">/ 12</span>
                </div>
              </div>
              <p className="text-[10px] font-sans text-text-tertiary">
                Prorated calc: ({tenureMonths || 0} / 12 mos) × {formatRupiah(effectiveBase)} ={" "}
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
                className="w-full px-2.5 py-1.5 rounded bg-surface border border-border text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
              />
            </div>
          )}

          {fieldErrors.thr && (
            <div className="text-[10px] font-sans text-delta-negative">
              {fieldErrors.thr}
            </div>
          )}
        </div>
        )}

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

      {/* DIRECT PAYROLL DEDUCTIONS & CUSTOM ADJUSTMENTS */}
      <div className="pt-4 border-t border-border-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold font-sans text-text-primary">
              Direct Payroll Deductions &amp; Custom Items
            </h3>
            <p className="text-[11px] font-sans text-text-tertiary">
              Post-net deductions (e.g. early salary advance, loan clawback) or custom allowances for {month}/{year}.
            </p>
          </div>
          <span className="font-mono text-[11px] text-text-tertiary">
            {periodAdjustments.length} item{periodAdjustments.length === 1 ? "" : "s"}
          </span>
        </div>

        {periodAdjustments.length > 0 && (
          <div className="space-y-1.5">
            {periodAdjustments.map((adj) => (
              <div
                key={adj.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-border-subtle bg-surface-subtle text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-text-primary truncate">{adj.label}</div>
                  <div className="text-[10px] font-mono text-text-tertiary">
                    {STAGE_BADGE_LABELS[adj.stage]}
                    {adj.notes ? ` · ${adj.notes}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      adj.stage === "PRE_NET_EARNING" ? "text-delta-positive" : "text-delta-negative"
                    }`}
                  >
                    {adj.stage === "PRE_NET_EARNING" ? "+" : "-"}
                    {formatRupiah(adj.amount)}
                  </span>
                  {!isLocked && (
                    <button
                      type="button"
                      disabled={isMutatingAdj}
                      onClick={() => void handleDeleteAdjustment(adj.id, adj.label)}
                      title={`Remove ${adj.label}`}
                      className="p-1 rounded text-text-tertiary hover:text-delta-negative hover:bg-canvas transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLocked && (
          <div className="p-3 rounded border border-border-subtle bg-canvas/60 space-y-2.5">
            {templates.length > 0 && (
              <div>
                <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                  Quick-Fill from Saved Payroll Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                >
                  <option value="">Custom one-off item...</option>
                  {templates
                    .filter((tpl) => tpl.isActive)
                    .map((tpl) => (
                      <option key={tpl.id} value={String(tpl.id)}>
                        {tpl.label} ({STAGE_BADGE_LABELS[tpl.stage]})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                  Stage
                </label>
                <select
                  value={adjStage}
                  onChange={(e) => setAdjStage(e.target.value as PayrollAdjustmentStage)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                >
                  <option value="POST_NET_DEDUCTION">Direct Deduction (Post-Net)</option>
                  <option value="PRE_NET_DEDUCTION">Pre-Net Deduction</option>
                  <option value="PRE_NET_EARNING">Pre-Net Earning (+)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                  Amount (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  placeholder="e.g. 350000"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                  Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Early Salary Advance Repayment"
                  value={adjLabel}
                  onChange={(e) => setAdjLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-tertiary mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  placeholder="Reference / slip line"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isMutatingAdj || !adjLabel.trim() || !(Number(adjAmount) > 0)}
              onClick={() => void handleAddAdjustment()}
              className="w-full py-1.5 px-3 rounded border border-border bg-surface hover:bg-surface-hover text-xs font-mono text-text-primary disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isMutatingAdj ? "Saving Item..." : "Add Payroll Adjustment"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

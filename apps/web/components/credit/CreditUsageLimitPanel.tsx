"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, Lock } from "lucide-react";
import {
  CreditLimitCalculationResult,
  InstrumentLimitEvaluation,
  updateCreditUsageLimit,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface CreditUsageLimitPanelProps {
  limitData: CreditLimitCalculationResult;
}

function getStatusLabel(status: InstrumentLimitEvaluation["status"]): string {
  switch (status) {
    case "EXCEEDED":
      return "Limit Exceeded";
    case "APPROACHING_LIMIT":
      return "Approaching Limit";
    case "OK":
      return "Within Limit";
    case "UNSET":
    default:
      return "No Limit Set";
  }
}

function getStatusColorClasses(status: InstrumentLimitEvaluation["status"]): {
  bar: string;
  text: string;
} {
  switch (status) {
    case "EXCEEDED":
      return {
        bar: "bg-delta-negative",
        text: "text-delta-negative",
      };
    case "APPROACHING_LIMIT":
      return {
        bar: "bg-caution",
        text: "text-caution",
      };
    case "OK":
      return {
        bar: "bg-delta-positive",
        text: "text-delta-positive",
      };
    case "UNSET":
    default:
      return {
        bar: "bg-border-strong",
        text: "text-text-tertiary",
      };
  }
}

export function CreditUsageLimitPanel({
  limitData,
}: CreditUsageLimitPanelProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [ccLimitInput, setCcLimitInput] = useState(
    String(limitData.ccEvaluation.limit || 0)
  );
  const [paylaterLimitInput, setPaylaterLimitInput] = useState(
    String(limitData.paylaterEvaluation.limit || 0)
  );
  const [saveAsGlobalDefault, setSaveAsGlobalDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLocked = limitData.snapshotStatus === "LOCKED";
  const { ceilingBreakdown, ccEvaluation, paylaterEvaluation } = limitData;

  useEffect(() => {
    setCcLimitInput(String(limitData.ccEvaluation.limit || 0));
    setPaylaterLimitInput(String(limitData.paylaterEvaluation.limit || 0));
  }, [
    limitData.month,
    limitData.year,
    limitData.ccEvaluation.limit,
    limitData.paylaterEvaluation.limit,
  ]);

  const handleApplyPreset = (mode: "OPTIMAL" | "SAFE") => {
    if (isLocked) return;
    setIsEditing(true);
    setErrorMessage(null);

    if (mode === "OPTIMAL") {
      // Allocate based on remaining optimal headroom for each instrument
      setCcLimitInput(String(ceilingBreakdown.remainingOptimalHeadroomForCc));
      setPaylaterLimitInput(
        String(ceilingBreakdown.remainingOptimalHeadroomForPaylater)
      );
    } else {
      setCcLimitInput(String(ceilingBreakdown.remainingSafeHeadroomForCc));
      setPaylaterLimitInput(
        String(ceilingBreakdown.remainingSafeHeadroomForPaylater)
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isSubmitting) return;

    const parsedCc = Math.max(
      0,
      parseInt(ccLimitInput.replace(/\D/g, ""), 10) || 0
    );
    const parsedPaylater = Math.max(
      0,
      parseInt(paylaterLimitInput.replace(/\D/g, ""), 10) || 0
    );

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await updateCreditUsageLimit({
      month: limitData.month,
      year: limitData.year,
      ccUsageLimit: parsedCc,
      paylaterUsageLimit: parsedPaylater,
      saveAsGlobalDefault,
    });

    setIsSubmitting(false);

    if (res.success) {
      setIsSaved(true);
      setIsEditing(false);
      setTimeout(() => setIsSaved(false), 2000);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setErrorMessage(res.error || "Failed to update credit usage limits");
    }
  };

  const optimalConstraintLabel =
    ceilingBreakdown.optimalBindingConstraint === "CASHFLOW_SAVINGS_PROTECTION"
      ? "Constrained by Remaining Cashflow (Protects P1 Savings)"
      : "Constrained by 20% Optimal Debt Ratio";

  const safeConstraintLabel =
    ceilingBreakdown.safeBindingConstraint === "CASHFLOW_DEFICIT_PROTECTION"
      ? "Constrained by Remaining Cashflow (Prevents Waterfall Deficit)"
      : "Constrained by 35% Max Manageable Debt Ratio";

  const renderInstrumentCard = (
    title: string,
    subtitle: string,
    evaluation: InstrumentLimitEvaluation,
    safeHeadroom: number
  ) => {
    const colors = getStatusColorClasses(evaluation.status);
    const barWidth =
      evaluation.limit > 0
        ? Math.min(100, Math.max(0, evaluation.utilizationPercent))
        : 0;

    return (
      <div className="p-4 rounded border border-border-subtle bg-surface-subtle/30 flex flex-col justify-between space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold font-sans text-text-primary">
              {title}
            </div>
            <div className="text-[11px] font-sans text-text-tertiary">
              {subtitle}
            </div>
          </div>
          <span className={`text-[11px] font-mono font-medium ${colors.text}`}>
            {getStatusLabel(evaluation.status)}
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-base font-bold tabular-nums text-text-primary">
              {formatRupiah(evaluation.usage)}
            </span>
            <span className="font-mono text-xs tabular-nums text-text-tertiary">
              {evaluation.limit > 0
                ? `/ ${formatRupiah(evaluation.limit)} (${evaluation.utilizationPercent.toFixed(1)}%)`
                : "/ Uncapped (Rp 0)"}
            </span>
          </div>

          <div className="w-full h-1.5 bg-surface rounded-sm overflow-hidden mt-2 border border-border-subtle/60">
            <div
              className={`h-full transition-all duration-200 ${colors.bar}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-border-subtle/60">
          {evaluation.status === "EXCEEDED" ? (
            <span className="text-delta-negative">
              Over limit by +{formatRupiah(evaluation.exceededBy)}
            </span>
          ) : evaluation.limit > 0 ? (
            <span className="text-text-secondary">
              Remaining cap: {formatRupiah(evaluation.remainingBeforeLimit)}
            </span>
          ) : (
            <span className="text-text-tertiary">
              Set a period limit to enable breach alerts
            </span>
          )}
          <span className="text-text-tertiary">
            Safe max: {formatRupiah(safeHeadroom)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-3.5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              Per-Period Credit Usage Limit & Safe Ceiling ({limitData.month}/
              {limitData.year})
            </h2>
            {isSaved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-delta-positive">
                <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
                Limits Updated
              </span>
            )}
          </div>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Tracks period Credit Card and PayLater obligations against your personal caps and waterfall-bounded safe ceilings.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLocked ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-tertiary">
              <Lock className="w-3 h-3" strokeWidth={1.8} />
              Frozen History (Locked)
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleApplyPreset("OPTIMAL")}
                className="px-2.5 py-1.5 rounded border border-border-subtle bg-surface-subtle hover:bg-surface-hover text-[11px] font-sans text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Pre-fill period limits using the Savings-Safe Optimal Ceiling"
              >
                Use Optimal Ceiling
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("SAFE")}
                className="px-2.5 py-1.5 rounded border border-border-subtle bg-surface-subtle hover:bg-surface-hover text-[11px] font-sans text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Pre-fill period limits using the Deficit-Safe Maximum Ceiling"
              >
                Use Safe Ceiling
              </button>
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="px-3 py-1.5 rounded border border-border bg-surface-active hover:bg-border-active text-[11px] font-sans font-medium text-text-primary transition-colors cursor-pointer"
              >
                {isEditing ? "Close Editor" : "Configure Period Limits"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Breach or Ceiling Warning Banner (only shown when exceeded) */}
      {(limitData.isAnyConfiguredLimitExceeded ||
        limitData.isSafeCeilingExceeded) && (
        <div className="p-3 rounded border border-[rgba(224,108,83,0.35)] bg-[rgba(224,108,83,0.08)] flex items-start gap-2.5 text-xs font-sans">
          <AlertTriangle
            className="w-4 h-4 text-delta-negative shrink-0 mt-0.5"
            strokeWidth={1.8}
          />
          <div className="space-y-0.5 text-text-primary">
            {limitData.isAnyConfiguredLimitExceeded && (
              <div>
                <strong className="font-semibold text-delta-negative">
                  Configured Period Limit Exceeded:
                </strong>{" "}
                {ccEvaluation.status === "EXCEEDED" &&
                  `Credit Card due (${formatRupiah(ccEvaluation.usage)}) exceeds limit (${formatRupiah(ccEvaluation.limit)}) by +${formatRupiah(ccEvaluation.exceededBy)}. `}
                {paylaterEvaluation.status === "EXCEEDED" &&
                  `PayLater bill (${formatRupiah(paylaterEvaluation.usage)}) exceeds limit (${formatRupiah(paylaterEvaluation.limit)}) by +${formatRupiah(paylaterEvaluation.exceededBy)}.`}
              </div>
            )}
            {limitData.isSafeCeilingExceeded && (
              <div className="text-text-secondary">
                Combined Credit Card + PayLater obligations (
                <span className="font-mono text-text-primary">
                  {formatRupiah(limitData.currentCombinedRevolvingUsage)}
                </span>
                ) exceed the period&apos;s Deficit-Safe Ceiling (
                <span className="font-mono text-text-primary">
                  {formatRupiah(ceilingBreakdown.recommendedSafeCombinedCeiling)}
                </span>
                ), eating into upfront operational or fixed essentials.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main 12-Column Asymmetric Layout: 7 cols Instrument Gauges, 5 cols Waterfall Safe Recommendation */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 grid grid-cols-2 gap-4">
          {renderInstrumentCard(
            "Credit Card Period Usage",
            `Statement due in ${limitData.month}/${limitData.year} (Bank Facility: ${formatRupiah(limitData.bankCreditLimit)})`,
            ccEvaluation,
            ceilingBreakdown.remainingSafeHeadroomForCc
          )}
          {renderInstrumentCard(
            "PayLater Period Usage",
            `Bulk PayLater due 25th of ${limitData.month}/${limitData.year}`,
            paylaterEvaluation,
            ceilingBreakdown.remainingSafeHeadroomForPaylater
          )}
        </div>

        {/* Right 5 cols: Waterfall-Bounded Safe Recommendation Breakdown */}
        <div className="col-span-5 p-4 rounded border border-border-subtle bg-surface-subtle/20 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-border-subtle/70 pb-2">
            <span className="text-xs font-semibold font-sans text-text-primary">
              Waterfall-Bounded Safe Ceilings (CC + PayLater)
            </span>
            <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
              Current Combined:{" "}
              <strong className="text-text-primary">
                {formatRupiah(limitData.currentCombinedRevolvingUsage)}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded bg-surface border border-border-subtle">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                Optimal Ceiling (P1 Safe)
              </div>
              <div className="text-sm font-mono font-bold tabular-nums text-delta-positive mt-0.5">
                {formatRupiah(
                  ceilingBreakdown.recommendedOptimalCombinedCeiling
                )}
              </div>
              <div className="text-[10px] font-sans text-text-tertiary mt-1 leading-tight">
                {optimalConstraintLabel}
              </div>
            </div>

            <div className="p-2.5 rounded bg-surface border border-border-subtle">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                Max Safe Ceiling (No Deficit)
              </div>
              <div className="text-sm font-mono font-bold tabular-nums text-caution mt-0.5">
                {formatRupiah(ceilingBreakdown.recommendedSafeCombinedCeiling)}
              </div>
              <div className="text-[10px] font-sans text-text-tertiary mt-1 leading-tight">
                {safeConstraintLabel}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 text-[10px] font-mono text-text-tertiary border-t border-border-subtle/60">
            <div>
              <span className="block text-text-tertiary/80">Income</span>
              <span className="text-text-secondary tabular-nums">
                {formatRupiah(ceilingBreakdown.totalIncome)}
              </span>
            </div>
            <div>
              <span className="block text-text-tertiary/80">Op. & Fixed</span>
              <span className="text-text-secondary tabular-nums">
                {formatRupiah(ceilingBreakdown.upfrontEssentialsAndOperational)}
              </span>
            </div>
            <div>
              <span className="block text-text-tertiary/80">Locked Debt</span>
              <span className="text-text-secondary tabular-nums">
                {formatRupiah(
                  ceilingBreakdown.fixedLockedDebt +
                    ceilingBreakdown.manualDeductions
                )}
              </span>
            </div>
            <div>
              <span className="block text-text-tertiary/80">P1 Savings</span>
              <span className="text-text-secondary tabular-nums">
                {formatRupiah(ceilingBreakdown.savingsTarget)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Editor Drawer (when active on non-locked period) */}
      {isEditing && !isLocked && (
        <form
          onSubmit={handleSave}
          className="pt-4 border-t border-border-subtle space-y-3"
        >
          {errorMessage && (
            <div className="p-2.5 rounded border border-urgency/40 bg-urgency/10 text-xs font-sans text-urgency">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-3">
              <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
                Credit Card Period Limit (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={ccLimitInput}
                onChange={(e) => setCcLimitInput(e.target.value)}
                disabled={isSubmitting || isRefreshing}
                className="w-full bg-surface-subtle border border-border focus:border-accent rounded px-3 py-1.5 text-xs font-mono text-text-primary tabular-nums outline-none"
              />
              <span className="text-[10px] font-mono text-text-tertiary mt-0.5 block">
                {formatRupiah(parseInt(ccLimitInput, 10) || 0)} (0 = Unset)
              </span>
            </div>

            <div className="col-span-3">
              <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
                PayLater Period Limit (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={paylaterLimitInput}
                onChange={(e) => setPaylaterLimitInput(e.target.value)}
                disabled={isSubmitting || isRefreshing}
                className="w-full bg-surface-subtle border border-border focus:border-accent rounded px-3 py-1.5 text-xs font-mono text-text-primary tabular-nums outline-none"
              />
              <span className="text-[10px] font-mono text-text-tertiary mt-0.5 block">
                {formatRupiah(parseInt(paylaterLimitInput, 10) || 0)} (0 = Unset)
              </span>
            </div>

            <div className="col-span-4 pb-5">
              <label className="inline-flex items-center gap-2 text-xs font-sans text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveAsGlobalDefault}
                  onChange={(e) => setSaveAsGlobalDefault(e.target.checked)}
                  disabled={isSubmitting || isRefreshing}
                  className="rounded border-border bg-surface-subtle"
                />
                <span>
                  Also save as Global Default for newly created periods
                </span>
              </label>
            </div>

            <div className="col-span-2 pb-4 flex justify-end gap-2">
              <button
                type="submit"
                disabled={isSubmitting || isRefreshing}
                className="px-4 py-1.5 rounded bg-text-primary text-surface text-xs font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Saving..." : "Save Limits"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

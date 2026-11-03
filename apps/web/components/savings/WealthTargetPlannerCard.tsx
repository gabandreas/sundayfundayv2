"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  SavingsVault,
  saveWealthTarget,
  WealthFeasibilityStatus,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface WealthTargetPlannerCardProps {
  vault: SavingsVault;
  baselineMonth?: number;
  baselineYear?: number;
}

export function WealthTargetPlannerCard({
  vault,
  baselineMonth = 10,
  baselineYear = 2026,
}: WealthTargetPlannerCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const savedConfig = vault.overview?.wealthTargetConfig;
  const initialPlan = vault.overview?.wealthTargetPlan;
  const capacity = vault.overview?.financialCapacity;
  const kpi = vault.overview?.kpi;

  const confirmedVaultBalance = vault.balance ?? 0;
  const plannedP1Balance = kpi?.totalPlanned2026P1 ?? 0;
  const avgMonthlySavingsP1 = kpi?.avgMonthlySavingsP1 ?? 0;
  const netIncome = capacity?.currentPeriodNetIncome ?? 5_891_000;
  const maxSavableCapacity =
    capacity?.maxMonthlySavableCapacity ?? Math.max(0, netIncome - 4_000_000);

  // User input states
  const [targetAmountStr, setTargetAmountStr] = useState<string>(
    savedConfig?.targetWealthAmount
      ? savedConfig.targetWealthAmount.toString()
      : initialPlan?.targetBalance
      ? initialPlan.targetBalance.toString()
      : "15000000"
  );
  const [targetMonth, setTargetMonth] = useState<number>(
    savedConfig?.targetWealthMonth ?? initialPlan?.targetMonth ?? 10
  );
  const [targetYear, setTargetYear] = useState<number>(
    savedConfig?.targetWealthYear ?? initialPlan?.targetYear ?? (baselineYear + 1)
  );
  const [targetBase, setTargetBase] = useState<"CONFIRMED_VAULT" | "PLANNED_P1">(
    savedConfig?.targetWealthBase === "PLANNED_P1" ? "PLANNED_P1" : "CONFIRMED_VAULT"
  );

  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Numeric parse
  const targetBalance = useMemo(() => {
    const parsed = parseInt(targetAmountStr.replace(/\D/g, ""), 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }, [targetAmountStr]);

  const currentBaseBalance =
    targetBase === "PLANNED_P1" ? plannedP1Balance : confirmedVaultBalance;

  // Dynamic calculations
  const {
    shortfall,
    monthsRemaining,
    requiredMonthlySaving,
    pctOfIncome,
    status,
    statusBadge,
    explanation,
    realisticCompletionDate,
    realisticReachableAmount,
  } = useMemo(() => {
    const curSerial = baselineYear * 12 + baselineMonth;
    const tgtSerial = targetYear * 12 + targetMonth;
    const months = Math.max(1, tgtSerial - curSerial);

    const needed = Math.max(0, targetBalance - currentBaseBalance);
    const required = needed > 0 ? Math.ceil(needed / months) : 0;
    const pct = netIncome > 0 ? (required / netIncome) * 100 : 0;

    let st: WealthFeasibilityStatus = "FEASIBLE";
    let badgeText = "Realistic & On Track";
    let expText = "";

    if (needed === 0) {
      st = "FEASIBLE";
      badgeText = "Goal Reached (100% Funded)";
      expText = `Your ${
        targetBase === "PLANNED_P1" ? "planned 2026 P1" : "confirmed vault"
      } balance (${formatRupiah(currentBaseBalance)}) already meets or exceeds ${formatRupiah(
        targetBalance
      )}.`;
    } else if (required > maxSavableCapacity || pct > 50) {
      st = "UNREALISTIC";
      badgeText = "Unrealistic for Current Income & Obligations";
      expText = `Requires saving ${formatRupiah(
        required
      )}/mo (${pct.toFixed(
        1
      )}% of net income). Exceeds contractual uncommitted cashflow (${formatRupiah(
        maxSavableCapacity
      )}/mo) after routine bills and debt obligations.`;
    } else if (
      (avgMonthlySavingsP1 > 0 && required > avgMonthlySavingsP1 * 1.5) ||
      pct > 25
    ) {
      st = "STRETCH";
      badgeText = "Stretch Target";
      expText = `Requires ${formatRupiah(required)}/mo (${pct.toFixed(
        1
      )}% of income). This is 1.5x+ your current average P1 pace (${formatRupiah(
        avgMonthlySavingsP1
      )}/mo).`;
    } else {
      st = "FEASIBLE";
      badgeText = "Realistic & On Track";
      expText = `Requires ${formatRupiah(required)}/mo (${pct.toFixed(
        1
      )}% of income), comfortably within your uncommitted capacity of ${formatRupiah(
        maxSavableCapacity
      )}/mo.`;
    }

    // Realistic suggestions
    let compDate = "N/A";
    if (avgMonthlySavingsP1 > 0 && needed > 0) {
      const neededMonths = Math.ceil(needed / avgMonthlySavingsP1);
      const projSerial = curSerial + neededMonths;
      const pYear = Math.floor((projSerial - 1) / 12);
      const pMonth = ((projSerial - 1) % 12) + 1;
      compDate = `${pMonth}/${pYear} (${neededMonths} mo)`;
    }

    const reachable = currentBaseBalance + (avgMonthlySavingsP1 > 0 ? avgMonthlySavingsP1 : required) * months;

    return {
      shortfall: needed,
      monthsRemaining: months,
      requiredMonthlySaving: required,
      pctOfIncome: pct,
      status: st,
      statusBadge: badgeText,
      explanation: expText,
      realisticCompletionDate: compDate,
      realisticReachableAmount: reachable,
    };
  }, [
    targetBalance,
    currentBaseBalance,
    baselineMonth,
    baselineYear,
    targetMonth,
    targetYear,
    targetBase,
    netIncome,
    maxSavableCapacity,
    avgMonthlySavingsP1,
  ]);

  const handleSave = async () => {
    if (targetBalance <= 0) {
      setFeedbackMessage({
        type: "error",
        text: "Please enter a target wealth balance greater than Rp 0",
      });
      return;
    }

    setSaving(true);
    setFeedbackMessage(null);

    const res = await saveWealthTarget({
      targetAmount: targetBalance,
      targetMonth,
      targetYear,
      targetBase,
    });

    setSaving(false);

    if (res.success) {
      setFeedbackMessage({
        type: "success",
        text: "Target wealth plan saved successfully to global financial configuration.",
      });
      startTransition(() => {
        router.refresh();
      });
    } else {
      setFeedbackMessage({
        type: "error",
        text: res.error || "Failed to save target wealth plan.",
      });
    }
  };

  const statusStyles = {
    FEASIBLE: {
      bg: "bg-[rgba(16,183,141,0.08)]",
      border: "border-[rgba(16,183,141,0.25)]",
      badge: "bg-[rgba(16,183,141,0.15)] text-delta-positive border-[rgba(16,183,141,0.30)]",
      icon: <CheckCircle2 className="w-4 h-4 text-delta-positive shrink-0" />,
    },
    STRETCH: {
      bg: "bg-[rgba(229,155,44,0.08)]",
      border: "border-[rgba(229,155,44,0.25)]",
      badge: "bg-[rgba(229,155,44,0.15)] text-caution border-[rgba(229,155,44,0.30)]",
      icon: <AlertTriangle className="w-4 h-4 text-caution shrink-0" />,
    },
    UNREALISTIC: {
      bg: "bg-[rgba(255,56,56,0.08)]",
      border: "border-[rgba(255,56,56,0.25)]",
      badge: "bg-[rgba(255,56,56,0.15)] text-delta-negative border-[rgba(255,56,56,0.30)]",
      icon: <XCircle className="w-4 h-4 text-delta-negative shrink-0" />,
    },
  }[status];

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-surface-subtle border border-border-subtle flex items-center justify-center text-text-primary">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
              Target Wealth & Feasibility Guard
            </h3>
            <p className="text-xs font-sans text-text-secondary mt-0.5">
              Simulate capital targets against live cashflow capacity, required monthly run-rate, and income feasibility bounds.
            </p>
          </div>
        </div>

        {/* 1-Click Save Target Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded text-xs font-sans font-medium text-text-primary bg-surface-subtle border border-border hover:border-border-strong hover:bg-surface-active transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>Save Plan as Primary Target</span>
        </button>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3 rounded text-xs font-sans border ${
            feedbackMessage.type === "success"
              ? "bg-[rgba(16,183,141,0.10)] border-[rgba(16,183,141,0.3)] text-delta-positive"
              : "bg-[rgba(255,56,56,0.10)] border-[rgba(255,56,56,0.3)] text-delta-negative"
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* Input Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Input 1: Target Wealth Balance */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
            Target Wealth Balance
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary">
              Rp
            </span>
            <input
              type="text"
              value={
                targetAmountStr
                  ? parseInt(targetAmountStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                  : ""
              }
              onChange={(e) => setTargetAmountStr(e.target.value)}
              placeholder="15.000.000"
              className="w-full pl-8 pr-3 py-1.5 rounded bg-surface-subtle border border-border-subtle focus:border-border-strong text-xs font-mono text-text-primary outline-none"
            />
          </div>
        </div>

        {/* Input 2: Target Horizon (Month / Year) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
            Target Horizon
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(parseInt(e.target.value, 10))}
              className="w-full px-2 py-1.5 rounded bg-surface-subtle border border-border-subtle text-xs font-mono text-text-primary outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Month {m}
                </option>
              ))}
            </select>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
              className="w-full px-2 py-1.5 rounded bg-surface-subtle border border-border-subtle text-xs font-mono text-text-primary outline-none"
            >
              {[2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input 3: Base Comparison Pool Toggle */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
            Base Comparison Balance
          </label>
          <div className="flex rounded bg-surface-subtle border border-border-subtle p-0.5">
            <button
              type="button"
              onClick={() => setTargetBase("CONFIRMED_VAULT")}
              className={`flex-1 py-1 text-[11px] font-mono rounded transition-colors ${
                targetBase === "CONFIRMED_VAULT"
                  ? "bg-surface-active text-text-primary font-semibold"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Vault ({formatRupiah(confirmedVaultBalance)})
            </button>
            <button
              type="button"
              onClick={() => setTargetBase("PLANNED_P1")}
              className={`flex-1 py-1 text-[11px] font-mono rounded transition-colors ${
                targetBase === "PLANNED_P1"
                  ? "bg-surface-active text-text-primary font-semibold"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              2026 P1 ({formatRupiah(plannedP1Balance)})
            </button>
          </div>
        </div>

        {/* Input 4: Horizon Summary */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-text-tertiary uppercase tracking-wider block">
            Time Remaining
          </label>
          <div className="px-3 py-1.5 rounded bg-surface-subtle border border-border-subtle flex items-center justify-between text-xs font-mono">
            <span className="text-text-secondary">From {baselineMonth}/{baselineYear}:</span>
            <span className="font-semibold text-text-primary">{monthsRemaining} Months</span>
          </div>
        </div>
      </div>

      {/* Plan Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded bg-surface-subtle border border-border-subtle">
        <div>
          <span className="text-[10px] font-mono text-text-tertiary uppercase block">
            Current Base Balance
          </span>
          <span className="text-sm font-mono font-semibold text-text-primary mt-0.5 block">
            {formatRupiah(currentBaseBalance)}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            {targetBase === "CONFIRMED_VAULT" ? "Confirmed in Vault" : "Planned 2026 P1"}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-text-tertiary uppercase block">
            Remaining Shortfall
          </span>
          <span className="text-sm font-mono font-semibold text-text-primary mt-0.5 block">
            {formatRupiah(shortfall)}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            {shortfall === 0 ? "Fully funded" : "To accumulate"}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-text-tertiary uppercase block">
            Required Monthly Saving
          </span>
          <span className="text-sm font-mono font-bold text-text-primary mt-0.5 block">
            {formatRupiah(requiredMonthlySaving)}
            <span className="text-xs font-normal text-text-secondary"> /mo</span>
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            Across {monthsRemaining} remaining cycles
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-text-tertiary uppercase block">
            Income Share & Capacity
          </span>
          <span className="text-sm font-mono font-semibold text-text-primary mt-0.5 block">
            {pctOfIncome.toFixed(1)}%
            <span className="text-xs font-normal text-text-secondary"> of Net Pay</span>
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            Cap: {formatRupiah(maxSavableCapacity)}/mo
          </span>
        </div>
      </div>

      {/* Feasibility Guard Evaluation Banner */}
      <div className={`p-4 rounded-lg border ${statusStyles.bg} ${statusStyles.border} space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {statusStyles.icon}
            <span className="text-xs font-mono font-semibold tracking-wide uppercase text-text-primary">
              Feasibility Verdict
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${statusStyles.badge}`}>
              {statusBadge}
            </span>
          </div>

          <div className="text-[11px] font-mono text-text-secondary">
            Net Monthly Income: <span className="font-semibold text-text-primary">{formatRupiah(netIncome)}</span>
          </div>
        </div>

        <p className="text-xs font-sans text-text-secondary leading-relaxed">
          {explanation}
        </p>

        {/* Realistic Alternative Suggestion Box */}
        {status !== "FEASIBLE" && (
          <div className="pt-2.5 border-t border-border-subtle/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="flex items-start gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <span className="text-text-tertiary block">
                  At current pace ({formatRupiah(avgMonthlySavingsP1)}/mo):
                </span>
                <span className="text-text-primary font-medium">
                  {targetBalance.toLocaleString("id-ID")} reachable in {realisticCompletionDate}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <span className="text-text-tertiary block">
                  Reachable by {targetMonth}/{targetYear} at normal pace:
                </span>
                <span className="text-text-primary font-medium">
                  {formatRupiah(realisticReachableAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

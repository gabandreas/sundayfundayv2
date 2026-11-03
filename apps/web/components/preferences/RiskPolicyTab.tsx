"use strict";
"use client";

import React, { useState } from "react";
import {
  GlobalConfig,
  FinancialPolicyConfig,
  updateGlobalConfig,
  evaluateAutoClosePeriods,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { DatabaseBackupRestoreCard } from "./DatabaseBackupRestoreCard";
import { Clock, RefreshCw } from "lucide-react";

interface RiskPolicyTabProps {
  config: GlobalConfig;
}

const DEFAULT_POLICY: FinancialPolicyConfig = {
  optimalDebtRatioPercent: 20,
  maxSafeDebtRatioPercent: 35,
  targetSavingsRatePercent: 20,
  criticalOperationalFloorRp: 1000000,
  runwayMilestoneMonths: [3, 6, 12],
};

export function RiskPolicyTab({ config }: RiskPolicyTabProps) {
  const policy: FinancialPolicyConfig = config.financialPolicy || DEFAULT_POLICY;

  const [optimalDebtRatio, setOptimalDebtRatio] = useState<number>(
    policy.optimalDebtRatioPercent ?? 20
  );
  const [maxSafeDebtRatio, setMaxSafeDebtRatio] = useState<number>(
    policy.maxSafeDebtRatioPercent ?? 35
  );
  const [targetSavingsRate, setTargetSavingsRate] = useState<number>(
    policy.targetSavingsRatePercent ?? 20
  );
  const [criticalFloorRp, setCriticalFloorRp] = useState<number>(
    policy.criticalOperationalFloorRp ?? 1000000
  );
  const [milestonesStr, setMilestonesStr] = useState<string>(
    (policy.runwayMilestoneMonths ?? [3, 6, 12]).join(", ")
  );

  const [bankCreditLimit, setBankCreditLimit] = useState<number>(config.creditLimit || 7000000);
  const [ccUsageLimit, setCcUsageLimit] = useState<number>(config.ccUsageLimit || 0);
  const [paylaterUsageLimit, setPaylaterUsageLimit] = useState<number>(
    config.paylaterUsageLimit || 0
  );

  // Auto-Close Period Engine States
  const [autoCloseEnabled, setAutoCloseEnabled] = useState<boolean>(
    config.autoCloseEnabled ?? true
  );
  const [autoCloseAfterDays, setAutoCloseAfterDays] = useState<number>(
    config.autoCloseAfterDays ?? 14
  );
  const [activeTrackingStartMonth, setActiveTrackingStartMonth] = useState<number>(
    config.activeTrackingStartMonth ?? 10
  );
  const [activeTrackingStartYear, setActiveTrackingStartYear] = useState<number>(
    config.activeTrackingStartYear ?? 2026
  );
  const [evaluatingAutoClose, setEvaluatingAutoClose] = useState<boolean>(false);
  const [autoCloseResult, setAutoCloseResult] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const handleEvaluateAutoClose = async () => {
    setEvaluatingAutoClose(true);
    setAutoCloseResult(null);
    try {
      const res = await evaluateAutoClosePeriods();
      if (res.success && res.data) {
        setAutoCloseResult(
          `Evaluated ${res.data.checkedCount} draft period(s). Automatically locked ${res.data.autoClosedCount} period(s).`
        );
      } else {
        setAutoCloseResult(res.error || "Failed to evaluate auto-close periods.");
      }
    } catch (e: any) {
      setAutoCloseResult(e.message || "Network error while evaluating auto-close.");
    } finally {
      setEvaluatingAutoClose(false);
    }
  };

  const handleSave = async () => {
    if (optimalDebtRatio > maxSafeDebtRatio) {
      setFeedback({
        type: "error",
        message: "Optimal debt ratio cannot exceed max safe debt ratio.",
      });
      return;
    }

    const milestoneArr = milestonesStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    const financialPolicy: FinancialPolicyConfig = {
      optimalDebtRatioPercent: optimalDebtRatio,
      maxSafeDebtRatioPercent: maxSafeDebtRatio,
      targetSavingsRatePercent: targetSavingsRate,
      criticalOperationalFloorRp: criticalFloorRp,
      runwayMilestoneMonths: milestoneArr.length > 0 ? milestoneArr : [3, 6, 12],
    };

    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await updateGlobalConfig({
        creditLimit: bankCreditLimit,
        ccUsageLimit,
        paylaterUsageLimit,
        financialPolicyJson: financialPolicy,
        autoCloseEnabled,
        autoCloseAfterDays,
        activeTrackingStartMonth,
        activeTrackingStartYear,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: "Risk policy thresholds and credit limits saved successfully.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to save risk policy.",
        });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Network error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 rounded text-xs border ${
            feedback.type === "success"
              ? "bg-[#16231c] border-[#204e35] text-[#4ade80]"
              : "bg-[#271719] border-[#5e272b] text-[#f87171]"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Advisory & Audit Risk Policy */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight mb-1">
          Financial Advisory & Discipline Audit Thresholds
        </h2>
        <p className="text-xs text-text-tertiary mb-4">
          Defines the mathematical boundaries used by the Discipline Audit and Credit Limit Recommendation engines.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Optimal Debt Ratio Ceiling
            </label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min={0}
                max={100}
                value={optimalDebtRatio}
                onChange={(e) => setOptimalDebtRatio(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
              <span className="text-xs text-text-tertiary font-mono">%</span>
            </div>
            <p className="text-[10px] text-text-tertiary mt-1">Default 20%</p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Max Safe Debt Ratio (Stress Line)
            </label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min={0}
                max={100}
                value={maxSafeDebtRatio}
                onChange={(e) => setMaxSafeDebtRatio(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
              <span className="text-xs text-text-tertiary font-mono">%</span>
            </div>
            <p className="text-[10px] text-text-tertiary mt-1">Default 35%</p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Target Savings Rate
            </label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min={0}
                max={100}
                value={targetSavingsRate}
                onChange={(e) => setTargetSavingsRate(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
              <span className="text-xs text-text-tertiary font-mono">%</span>
            </div>
            <p className="text-[10px] text-text-tertiary mt-1">Default 20% of net income</p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Critical Living Floor
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={criticalFloorRp}
                onChange={(e) => setCriticalFloorRp(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              Shortfall floor: {formatRupiah(criticalFloorRp)}
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Emergency Runway Milestones (Months)
            </label>
            <input
              type="text"
              value={milestonesStr}
              onChange={(e) => setMilestonesStr(e.target.value)}
              placeholder="e.g. 3, 6, 12"
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
            />
            <p className="text-[10px] text-text-tertiary mt-1">
              Comma-separated target milestone months for emergency runway evaluation
            </p>
          </div>
        </div>
      </div>

      {/* Credit Limits & Usage Controls */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight mb-1">
          Credit Limits & Spend Ceilings
        </h2>
        <p className="text-xs text-text-tertiary mb-4">
          Master bank limits and revolving usage budgets provisioned to periods.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Total Bank Credit Limit
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={bankCreditLimit}
                onChange={(e) => setBankCreditLimit(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(bankCreditLimit)}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Credit Card Usage Limit
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={ccUsageLimit}
                onChange={(e) => setCcUsageLimit(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {ccUsageLimit > 0 ? formatRupiah(ccUsageLimit) : "Unconfigured (0)"}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              PayLater Usage Limit
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={paylaterUsageLimit}
                onChange={(e) => setPaylaterUsageLimit(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {paylaterUsageLimit > 0 ? formatRupiah(paylaterUsageLimit) : "Unconfigured (0)"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-2 bg-[#282e3d] hover:bg-[#343b4e] text-text-primary font-medium rounded text-xs border border-[#3b4356] transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Risk Policy & Credit Limits"}
          </button>
        </div>
      </div>

      {/* Auto-Close Period Engine Configuration */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#282e3d] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-primary" />
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                Period Lifecycle & Auto-Close Automation
              </h2>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5">
              Automatically locks draft periods once their consumption cycle ends plus grace window, preventing retroactive alterations.
            </p>
          </div>

          <button
            type="button"
            onClick={handleEvaluateAutoClose}
            disabled={evaluatingAutoClose}
            className="px-3 py-1.5 rounded text-xs font-sans font-medium text-text-primary bg-[#202533] border border-[#2e3547] hover:bg-[#282f42] transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer disabled:opacity-50"
          >
            {evaluatingAutoClose ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Evaluate Auto-Close Now</span>
          </button>
        </div>

        {autoCloseResult && (
          <div className="p-3 rounded bg-[rgba(16,183,141,0.10)] border border-[rgba(16,183,141,0.30)] text-xs font-mono text-delta-positive">
            {autoCloseResult}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded bg-[#0c0e14] border border-[#282e3d]">
            <input
              type="checkbox"
              id="autoCloseEnabled"
              checked={autoCloseEnabled}
              onChange={(e) => setAutoCloseEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-[#282e3d] accent-accent cursor-pointer"
            />
            <label htmlFor="autoCloseEnabled" className="text-xs text-text-primary font-medium cursor-pointer">
              Enable Auto-Close Engine
              <span className="block text-[10px] text-text-tertiary font-normal mt-0.5">
                Automatically finalizes draft periods
              </span>
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Grace Period (Days Post-Cycle)
            </label>
            <input
              type="number"
              value={autoCloseAfterDays}
              onChange={(e) => setAutoCloseAfterDays(Math.max(1, parseInt(e.target.value, 10) || 14))}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
            />
            <p className="text-[10px] text-text-tertiary mt-1">
              Days after cycle end date before status flips to LOCKED (default: 14)
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Active Tracking Boundary
            </label>
            <div className="px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-secondary">
              {activeTrackingStartMonth}/{activeTrackingStartYear} onward
            </div>
            <p className="text-[10px] text-text-tertiary mt-1">
              Periods prior to this boundary remain in their historical state
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-2 bg-[#282e3d] hover:bg-[#343b4e] text-text-primary font-medium rounded text-xs border border-[#3b4356] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save Lifecycle Settings"}
          </button>
        </div>
      </div>

      {/* Full Disaster Recovery & Database Backup / Restore */}
      <DatabaseBackupRestoreCard />
    </div>
  );
}

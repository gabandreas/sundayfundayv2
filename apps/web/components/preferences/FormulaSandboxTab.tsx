"use strict";
"use client";

import React, { useState, useEffect } from "react";
import { GlobalConfig, simulateModularRules } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface FormulaSandboxTabProps {
  config: GlobalConfig;
}

export function FormulaSandboxTab({ config }: FormulaSandboxTabProps) {
  const [simIncome, setSimIncome] = useState<number>(config.baseSalary || 6000000);
  const [simDebts, setSimDebts] = useState<number>(2000000);
  const [simCycleDays, setSimCycleDays] = useState<number>(30);
  const [simWorkingDays, setSimWorkingDays] = useState<number>(20);

  const [simResult, setSimResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await simulateModularRules({
        income: simIncome,
        baseSalary: simIncome,
        debts: simDebts,
        cycleDays: simCycleDays,
        totalWorkingDays: simWorkingDays,
        payrollRules: config.payrollRules,
        allocationBuckets: config.allocationBuckets,
        surplusSplitRules: config.surplusSplitRules,
        financialPolicy: config.financialPolicy,
      });

      if (res.success) {
        setSimResult(res.data);
      } else {
        setError(res.error || "Simulation failed");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [simIncome, simDebts, simCycleDays, simWorkingDays]);

  return (
    <div className="space-y-6">
      {/* Simulation Input Controls */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Interactive Formula & Waterfall Sandbox
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Simulate how your current modular payroll and bucket rules behave under hypothetical cashflow scenarios.
            </p>
          </div>
          <button
            type="button"
            onClick={runSimulation}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#1f2430] hover:bg-[#282e3d] text-text-primary rounded text-xs border border-[#282e3d] transition-colors disabled:opacity-50"
          >
            {isLoading ? "Simulating..." : "Re-calculate"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Hypothetical Base Paycheck
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={simIncome}
                onChange={(e) => setSimIncome(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">{formatRupiah(simIncome)}</p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Hypothetical Debt Bills
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={simDebts}
                onChange={(e) => setSimDebts(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">{formatRupiah(simDebts)}</p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Consumption Cycle Days
            </label>
            <input
              type="number"
              min={20}
              max={40}
              value={simCycleDays}
              onChange={(e) => setSimCycleDays(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
            />
            <p className="text-[10px] text-text-tertiary mt-1">{simCycleDays} days in period</p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Attendance Working Days
            </label>
            <input
              type="number"
              min={0}
              max={31}
              value={simWorkingDays}
              onChange={(e) => setSimWorkingDays(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
            />
            <p className="text-[10px] text-text-tertiary mt-1">{simWorkingDays} weekdays</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#271719] border border-[#5e272b] text-[#f87171] rounded text-xs">
          {error}
        </div>
      )}

      {/* Simulation Results Display */}
      {simResult && (
        <div className="space-y-6">
          {/* Key Simulation KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-[#282e3d] bg-[#161922]">
              <span className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                Simulated Net Income
              </span>
              <span className="block text-xl font-serif font-bold text-text-primary mt-1 tabular-nums">
                {formatRupiah(simResult.payroll.finalTotalIncome)}
              </span>
              <span className="block text-[11px] text-text-tertiary mt-1 font-mono">
                Base Rp {formatRupiah(simResult.payroll.adjustedBaseSalary)}
              </span>
            </div>

            <div className="p-4 rounded-lg border border-[#282e3d] bg-[#161922]">
              <span className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                Debt Burden Ratio
              </span>
              <span className="block text-xl font-mono font-bold text-text-primary mt-1 tabular-nums">
                {simResult.policySummary.debtRatio}%
              </span>
              <span
                className={`block text-[11px] font-mono mt-1 ${
                  simResult.policySummary.isOptimalDebt
                    ? "text-emerald-400"
                    : simResult.policySummary.isHighDebt
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {simResult.policySummary.isOptimalDebt
                  ? "Optimal (<= 20%)"
                  : simResult.policySummary.isHighDebt
                  ? "High Burden (> 35%)"
                  : "Manageable"}
              </span>
            </div>

            <div className="p-4 rounded-lg border border-[#282e3d] bg-[#161922]">
              <span className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                Actual P1 Savings Rate
              </span>
              <span className="block text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                {simResult.policySummary.savingsRatePercent}%
              </span>
              <span className="block text-[11px] text-text-tertiary mt-1 font-mono">
                {formatRupiah(simResult.canonicalSnapshotColumns.actualSavings)} funded
              </span>
            </div>

            <div className="p-4 rounded-lg border border-[#282e3d] bg-[#161922]">
              <span className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                Waterfall Outcome
              </span>
              <span
                className={`block text-xl font-serif font-bold mt-1 ${
                  simResult.waterfall.isDeficit ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {simResult.waterfall.isDeficit ? "DEFICIT" : "SURPLUS"}
              </span>
              <span className="block text-[11px] text-text-tertiary mt-1 font-mono">
                {simResult.waterfall.isDeficit
                  ? `Shortfall: ${formatRupiah(simResult.waterfall.deficitUncovered)}`
                  : `P2 Leftover: ${formatRupiah(simResult.waterfall.actualSelfReward)}`}
              </span>
            </div>
          </div>

          {/* Simulated Bucket Realization Table */}
          <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
            <h3 className="text-sm font-semibold text-text-primary tracking-tight mb-3">
              Simulated Waterfall Allocations & Pocket Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#282e3d] text-text-tertiary uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Priority Tier</th>
                    <th className="py-2 px-3">Bucket</th>
                    <th className="py-2 px-3">Group</th>
                    <th className="py-2 px-3">Formula Expression</th>
                    <th className="py-2 px-3 text-right">Target</th>
                    <th className="py-2 px-3 text-right">Funded Amount</th>
                    <th className="py-2 px-3 text-right">Share of Income</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282e3d]">
                  {simResult.bucketRealizations.map((b: any) => {
                    const share =
                      simResult.payroll.finalTotalIncome > 0
                        ? ((b.fundedAmount / simResult.payroll.finalTotalIncome) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr key={b.bucketId}>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-[#282e3d] bg-[#0c0e14] text-text-secondary">
                            Tier {b.priorityTier}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-text-primary">{b.label}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-text-tertiary">
                          {b.group}
                        </td>
                        <td className="py-2 px-3 text-text-secondary font-mono text-[11px]">
                          {b.formulaType === "FIXED_AMOUNT" && `Fixed: ${formatRupiah(b.formulaValue)}`}
                          {b.formulaType === "PERCENT_OF_NET_INCOME" && `${b.formulaValue}% of Net Income`}
                          {b.formulaType === "PERCENT_OF_DISPOSABLE_AFTER_DEBT" &&
                            `${b.formulaValue}% of Cash after Debt`}
                          {b.formulaType === "DAILY_RATE_TIMES_CYCLE_DAYS" &&
                            `${formatRupiah(b.formulaValue)} × ${simCycleDays} days`}
                          {b.formulaType === "REMAINDER_OVERFLOW" && "Surplus Remainder Split"}
                          {b.capHit && ` [${b.capHit}]`}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-text-secondary">
                          {formatRupiah(b.baselineTarget)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-text-primary">
                          {formatRupiah(b.fundedAmount)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-text-tertiary">
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
